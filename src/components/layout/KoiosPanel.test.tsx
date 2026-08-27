import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPanel from './KoiosPanel'
import { sendChat } from './koios/koiosApi'
import api from '@/lib/api'
import { SelectionProvider, usePublishSelection } from '@/context/SelectionContext'

// KoiosAssistantBlock (mounted on the landing state, above KoiosRadar) uses
// react-query — a bare render() would throw "No QueryClient set" now that the
// panel mounts it. One fresh client per render, mirroring App.tsx's own provider.
function renderWithQuery(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>)
}

// jsdom has no scrollIntoView implementation; KoiosPanel calls it to keep the
// latest message in view on every messages/loading change.
Element.prototype.scrollIntoView = vi.fn()

// KoiosPanel imports @/lib/datetime (useLocale), which imports the real i18n
// singleton as a module-level side effect (src/i18n/index.ts) — unlike most
// component tests, every t() in this tree would then return actual Dutch copy
// instead of echoing the key. Stub useLocale directly so that import — and the
// real i18n init behind it — never happens; every useTranslation() falls back
// to its normal uninitialised-instance behaviour (t returns the key, and drops
// interpolation options entirely since there is no template to fill them into).
vi.mock('@/lib/datetime', () => ({ useLocale: () => 'nl-NL' }))

// KoiosPanel's own hooks call these on open — stub them so the test never hits
// the real network (useKoiosSettings fetches settings the moment `open` is true).
vi.mock('./koios/koiosApi', () => ({
  sendChat: vi.fn(),
  getKoiosSettings: vi.fn(() => Promise.resolve(null)),
  confirmPendingAction: vi.fn(),
  cancelPendingAction: vi.fn(),
}))
// KoiosRadar's own stats fetch (candidates/stats) via the shared heavyGet wrapper.
vi.mock('@/lib/heavyGet', () => ({ heavyGet: () => Promise.resolve({ data: { data: { attention: {} } } }) }))
// The mention menu's own fan-out/scoped search (KoiosMentionMenu) hits the real
// list endpoints via this client — mocked with a safe empty-results default so
// opening "@" never reaches a real network call; per-test overrides below give
// exactly one pickable row where a test needs to insert a manual mention.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
// No AuthProvider wraps this test tree, and useAuth()'s default context value
// is `null` — koiosMentionAccess.isCategoryVisible would then hide EVERY
// permission-gated category, leaving the mention menu empty. Full access, same
// stub shape as KoiosMentionMenu.test.tsx's own auth stub.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

// Landing state (Danny 21/7): the radar REPLACES the generic welcome bubble, it
// never sits alongside it, and only while no real conversation has started yet.
describe('KoiosPanel — landing state', () => {
  it('shows the Koios Advies radar instead of the welcome bubble when opened', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.getByText('common:koios.radar.title')).toBeInTheDocument()
    expect(screen.queryByText('koios.welcome')).toBeNull()
    // Let the radar's own stats fetch settle (mocked all-zero → empty state) so
    // the async state update lands inside RTL's act(), not after the test ends.
    await screen.findByText('common:koios.radar.empty')
  })

  // KOIOS-ASSISTANT-FE-1: the assistant block mounts on the landing state and
  // disappears the moment a real conversation starts (mirrors the radar's own contract).
  it('mounts the assistant block on the landing state and drops it once a message is sent', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('koios.assistant.title')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await waitFor(() => expect(sendChat).toHaveBeenCalled())
    expect(screen.queryByText('koios.assistant.title')).toBeNull()
  })

  // KOIOS-FEEDBACK-FE-1: the passthrough that makes the thumbs REAL — a reply
  // carrying prompt_log_id renders the feedback buttons, one without stays calm
  // (the Opus verify caught the type-only version rendering nothing, ever).
  it('renders the feedback thumbs only when the reply carries prompt_log_id', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({
      answer: 'Antwoord met log.', steps: [], usage: null, model: null, prompt_log_id: 'pl-1',
    })
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'log test' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await screen.findByText('Antwoord met log.')
    expect(screen.getByRole('button', { name: 'Nuttig' })).toBeInTheDocument()

    vi.mocked(sendChat).mockResolvedValueOnce({ answer: 'Antwoord zonder log.', steps: [] })
    fireEvent.change(textarea, { target: { value: 'zonder' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await screen.findByText('Antwoord zonder log.')
    expect(screen.getAllByRole('button', { name: 'Nuttig' })).toHaveLength(1)
  })
})

// Resizable panel (replaces the old two-fixed-width toggle) — the drag handle
// must render with real separator semantics, and the expand/collapse button
// must keep working alongside it (§6, requirement: don't silently drop it).
describe('KoiosPanel — resizable width', () => {
  beforeEach(() => localStorage.clear())

  it('renders a keyboard-operable resize handle and keeps the expand/collapse button', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    // The handle: real separator role + accessible name (never mouse-only).
    expect(screen.getByRole('separator', { name: 'koios.resizeHandle' })).toBeInTheDocument()
    // The pre-existing toggle button is still present, not replaced by the handle.
    expect(screen.getByRole('button', { name: 'expand' })).toBeInTheDocument()
  })

  it('restores a previously stored pixel width instead of a fixed preset', async () => {
    localStorage.setItem('koios.width', '480')
    const { container } = renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect((container.firstChild as HTMLElement).style.width).toBe('480px')
  })
})

// PLAN-KANDIDATEN batch 2: a 402/koios_credit_exhausted reply must show the
// translated credit notice, not the generic "couldn't reach Koios" line.
describe('KoiosPanel — known backend error codes', () => {
  const submitMessage = async (text: string) => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: text } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
  }

  it('shows the translated credit-exhausted notice on a 402 koios_credit_exhausted error', async () => {
    vi.mocked(sendChat).mockRejectedValueOnce({
      response: { status: 402, data: { code: 'koios_credit_exhausted' } },
    })
    await submitMessage('hello')
    expect(await screen.findByText('errors.koiosCreditExhausted')).toBeInTheDocument()
    expect(screen.queryByText('koios.errorReply')).toBeNull()
  })

  it('still shows the generic forbidden notice on a 403', async () => {
    vi.mocked(sendChat).mockRejectedValueOnce({ response: { status: 403, data: {} } })
    await submitMessage('hello')
    expect(await screen.findByText('koios.forbidden')).toBeInTheDocument()
  })

  it('falls back to the generic error notice for an unknown failure', async () => {
    vi.mocked(sendChat).mockRejectedValueOnce(new Error('network down'))
    await submitMessage('hello')
    expect(await screen.findByText('koios.errorReply')).toBeInTheDocument()
  })

  // KOIOS-CHAT-SIGNALS-FE-1: budget_exceeded is a 200 reply carrying stop_reason +
  // budget.reason (not a 402) — the panel must read the reason to pick daily vs
  // monthly copy instead of always the server's monthly-only answer text.
  it('shows the daily budget notice for a daily_user budget.reason', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({
      answer: 'Het Koios-maandbudget van deze organisatie is bereikt.', steps: [], usage: null, model: null,
      stop_reason: 'budget_exceeded', budget: { status: 'blocked', reason: 'daily_user' },
    })
    await submitMessage('hello')
    expect(await screen.findByText('koios.budgetExceededDaily')).toBeInTheDocument()
    expect(screen.queryByText('koios.budgetExceededMonthly')).toBeNull()
  })

  it('shows the monthly budget notice for a monthly budget.reason', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({
      answer: 'Het Koios-maandbudget van deze organisatie is bereikt.', steps: [], usage: null, model: null,
      stop_reason: 'budget_exceeded', budget: { status: 'blocked', reason: 'monthly' },
    })
    await submitMessage('hello')
    expect(await screen.findByText('koios.budgetExceededMonthly')).toBeInTheDocument()
    expect(screen.queryByText('koios.budgetExceededDaily')).toBeNull()
  })

  // DATUM-1: an AI-composed reply carrying a raw ISO date renders humanised (DD-MM-YYYY), never the raw ISO string.
  it('humanises an ISO date embedded in the assistant reply', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({
      answer: 'De intake staat gepland op 2026-09-02.', steps: [], usage: null, model: null, stopReason: null,
    })
    await submitMessage('wanneer is de intake')
    expect(await screen.findByText(/02-09-2026/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-09-02/)).toBeNull()
  })
})

// KOIOS-SEARCH-FIX-1 blocker (2): the panel SEAM — ambient/selection chips,
// dismiss, the outgoing sendChat context array, and the new-chat reset — was
// entirely untested before this fix. `sendChat` stays the mocked module-level
// stub (API-CREDITS-1: never a live /ai/koios/* call); only the chat TRANSPORT
// is mocked here, the chip/context wiring itself runs for real.
describe('KoiosPanel — context chips (seam)', () => {
  // Publishes a real SelectionContext selection — a memoized Set (not rebuilt
  // inline on every render) so this consumer's own context subscription can
  // never fight usePublishSelection's effect into a render loop (mirrors the
  // same guard useKoiosContextChips.test.tsx documents).
  function SelectionSeed({ ids }: { ids: string[] }) {
    const idsKey = ids.join(',')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally NOT depending on `ids` (a fresh array every render); idsKey already captures every real change
    const idSet = useMemo(() => new Set(ids), [idsKey])
    usePublishSelection('candidates', idSet)
    return null
  }
  function renderPanel({ hash, selectionIds }: { hash?: string; selectionIds?: string[] } = {}) {
    if (hash !== undefined) window.location.hash = hash
    return renderWithQuery(
      <SelectionProvider>
        {selectionIds && <SelectionSeed ids={selectionIds} />}
        <KoiosPanel open onClose={() => {}} onNavigate={() => {}} />
      </SelectionProvider>,
    )
  }

  beforeEach(() => { mockGet.mockReset(); mockGet.mockImplementation(() => Promise.resolve({ data: { data: [] } })) })
  afterEach(() => { window.location.hash = '' })

  // (a) an ambient chip renders from a drilldown hash.
  it('renders an ambient chip from a drilldown hash', async () => {
    renderPanel({ hash: '#candidates?open=c-1' })
    await screen.findByText('common:koios.radar.empty')
    // No real name source exists client-side (useKoiosContextChips banner) — the
    // honest fallback label is the koios.contextRecordFallback key; in this
    // file's uninitialised-i18n environment that key renders bare (see the
    // useLocale mock comment above), so its own remove control is the reliable
    // handle to assert the chip actually rendered.
    expect(screen.getByRole('button', { name: 'remove koios.contextRecordFallback' })).toBeInTheDocument()
  })

  // (b) a selection chip renders from SelectionContext with the count label.
  it('renders a selection chip from SelectionContext, via the count-label key', async () => {
    renderPanel({ selectionIds: ['1', '2'] })
    await screen.findByText('common:koios.radar.empty')
    // koios.selection.chip IS the count-carrying template ("{{count}} {{entity}}
    // selected"); the uninitialised i18n instance in this file drops the actual
    // numbers (no resource to interpolate into), so the KEY itself is what
    // proves this is the count label, not some other chip.
    expect(screen.getByRole('button', { name: 'remove koios.selection.chip' })).toBeInTheDocument()
  })

  // (c) dismissing a chip removes it.
  it('dismissing a chip removes it', async () => {
    renderPanel({ hash: '#candidates?open=c-1' })
    await screen.findByText('common:koios.radar.empty')
    const removeBtn = screen.getByRole('button', { name: 'remove koios.contextRecordFallback' })
    fireEvent.click(removeBtn)
    expect(screen.queryByRole('button', { name: 'remove koios.contextRecordFallback' })).toBeNull()
  })

  // (d) sending a message calls the mocked sendChat with a context array
  // carrying the real refs — ambient AND selection, deduped, singular types.
  it('sending a message calls sendChat with a context array carrying the refs', async () => {
    renderPanel({ hash: '#candidates?open=c-1', selectionIds: ['9'] })
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    // waitFor (rather than a bare assertion) lets useKoiosChat's own pending
    // async tail (setLoading/setMessages after the mocked sendChat resolves)
    // settle inside act() before the test ends.
    await waitFor(() => expect(sendChat).toHaveBeenCalledWith('hello', null, expect.arrayContaining([
      expect.objectContaining({ type: 'candidate', id: 'c-1' }),
      expect.objectContaining({ type: 'candidate', id: '9' }),
    ])))
  })

  // (d2) a manual @-mention of the SAME record as the ambient chip (c-1) dedupes
  // into ONE chip, in the ambient (first) slot — showing the manual hit's real
  // name instead of the ambient chip's generic fallback label (KoiosPanel.tsx
  // chipsById Map.set semantics: later entries update the value, not the slot).
  it('dedupes a manual mention of the ambient record into the ambient slot with the real name', async () => {
    mockGet.mockImplementation((url: string) => url === '/candidates'
      ? Promise.resolve({ data: { data: [{ id: 'c-1', name: 'Real Name' }, { id: 'c-2', name: 'Other Person' }] } })
      : Promise.resolve({ data: { data: [] } }))
    renderPanel({ hash: '#candidates?open=c-1' })
    await screen.findByText('common:koios.radar.empty')
    expect(screen.getByRole('button', { name: 'remove koios.contextRecordFallback' })).toBeInTheDocument()
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    // Pick ANOTHER record first, so slot ORDER is observable: the ambient slot
    // must stay first even though c-1's manual mention arrives after c-2's.
    fireEvent.change(textarea, { target: { value: '@other' } })
    await waitFor(() => expect(screen.getAllByText('Other Person').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Other Person')[0])
    fireEvent.change(textarea, { target: { value: '@real' } })
    await waitFor(() => expect(screen.getAllByText('Real Name').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Real Name')[0])
    // Only ONE chip for c-1 — the real name replaces the fallback, no duplicate —
    // AND it holds the ambient (first) slot; a delete-then-set dedupe that moves
    // the chip to the end must fail here (Opus mutation B, golf-1 verify).
    expect(screen.queryByRole('button', { name: 'remove koios.contextRecordFallback' })).toBeNull()
    const removeLabels = screen.getAllByRole('button', { name: /^remove / }).map(x => x.getAttribute('aria-label'))
    expect(removeLabels).toEqual(['remove Real Name', 'remove Other Person'])
  })

  // (e) chips clear on new chat — the MANUAL @-mention list only (ambient/
  // selection are ongoing page state, not a per-turn pick, and correctly
  // survive a new chat — see the file's own `newChat` comment).
  it('clears a manual @-mention chip on new chat', async () => {
    mockGet.mockImplementation((url: string) => url === '/candidates'
      ? Promise.resolve({ data: { data: [{ id: '99', name: 'Test Kandidaat' }] } })
      : Promise.resolve({ data: { data: [] } }))
    renderPanel()
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: '@ahmed' } })
    // '/candidates' backs BOTH the 'candidates' and 'leads' categories, so the
    // same fake row renders twice (once per group) — pick the first occurrence.
    await waitFor(() => expect(screen.getAllByText('Test Kandidaat').length).toBeGreaterThan(0))
    fireEvent.click(screen.getAllByText('Test Kandidaat')[0])
    expect(screen.getByRole('button', { name: 'remove Test Kandidaat' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'koios.newChatShort' }))
    expect(screen.queryByRole('button', { name: 'remove Test Kandidaat' })).toBeNull()
  })

  // Enter without an open mention menu still submits — the keyboard-forwarding
  // fix must never swallow a plain Enter on a normal message.
  it('Enter without an open mention menu still submits', async () => {
    renderPanel()
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => expect(sendChat).toHaveBeenCalledWith('hello', null, []))
  })
})

// KOIOS-SEARCH-FIX-2 (Opus blocker): the composer→menu keyboard seam. The menu
// half lives in KoiosMentionMenu.test.tsx; THESE tests drive the real textarea
// so the forwarding (ArrowUp/Down), the Enter-picks-not-submits early return,
// Escape, and the aria-activedescendant wiring are pinned on the panel itself.
describe('KoiosPanel — mention menu keyboard seam', () => {
  // Same minimal render as the chips describe (its helper is scoped there).
  function renderPanel() {
    return renderWithQuery(
      <SelectionProvider>
        <KoiosPanel open onClose={() => {}} onNavigate={() => {}} />
      </SelectionProvider>,
    )
  }
  afterEach(() => { window.location.hash = '' })

  beforeEach(() => {
    // Earlier describes exercise sendChat — clear it so not-called stays honest.
    vi.mocked(sendChat).mockClear()
    // One pickable row in EVERY category list the fan-out queries — so the menu
    // renders at least two groups and the highlight can cross a group boundary.
    mockGet.mockImplementation((url: string) => Promise.resolve({ data: { data: [
      { id: `${String(url).replace(/\W/g, '')}-1`, name: `Rij ${String(url).slice(1, 4)}`, first_name: 'Rij', last_name: String(url).slice(1, 4) },
    ] } }))
  })

  async function openMenu() {
    renderPanel()
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: '@ri' } })
    const listbox = await screen.findByRole('listbox')
    await waitFor(() => expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(1))
    return { textarea, listbox }
  }

  it('ArrowDown moves the highlight across rows and aria-activedescendant follows', async () => {
    const { textarea, listbox } = await openMenu()
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    const first = textarea.getAttribute('aria-activedescendant')
    expect(first).toBeTruthy()
    expect(within(listbox).getAllByRole('option').some(o => o.id === first)).toBe(true)
    // Crossing into the next row (next group when the first group has one row).
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    const second = textarea.getAttribute('aria-activedescendant')
    expect(second).toBeTruthy()
    expect(second).not.toBe(first)
  })

  it('Enter with a highlighted row PICKS it and never submits the chat', async () => {
    const { textarea } = await openMenu()
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    // The pick inserts a mention/chip; the chat transport must not fire.
    expect(sendChat).not.toHaveBeenCalled()
  })

  it('Escape closes the menu and aria-expanded goes false', async () => {
    const { textarea } = await openMenu()
    expect(textarea.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(textarea.getAttribute('aria-expanded')).toBe('false')
  })
})

// Danny 27-08 (panel idea): a landing card can be closed AWAY entirely via its X
// and summoned back via the composer toggle; the choice persists per user.
describe('KoiosPanel · landing cards close/summon (3b)', () => {
  it('the X hides the suggestions card, the sparkles toggle brings it back, persisted', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    // The suggestions card is present; its X (first 'common:close' inside it) hides it.
    expect(screen.getByText('koios.assistant.title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByText('koios.assistant.title')).toBeNull()
    expect(localStorage.getItem('koios.assistant.hidden')).toBe('true')
    // Composer toggle (aria-pressed=false while hidden) summons it back.
    const toggle = screen.getByRole('button', { name: 'koios.assistant.title', pressed: false })
    fireEvent.click(toggle)
    expect(screen.getByText('koios.assistant.title')).toBeInTheDocument()
    expect(localStorage.getItem('koios.assistant.hidden')).toBe('false')
  })
})


// Danny 27-08, three composer findings: stacked @'s, Tab-completion, Escape-cancel.
describe('KoiosPanel · mention polish (27-08)', () => {
  it('the @ button never stacks a second @ while the menu is open', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const atButton = screen.getByRole('button', { name: 'koios.addContext' })
    fireEvent.click(atButton)
    fireEvent.click(atButton)
    fireEvent.click(atButton)
    expect((screen.getByPlaceholderText('koios.taskPlaceholder') as HTMLTextAreaElement).value).toBe('@')
  })

  it('Escape cancels the half-typed mention fragment entirely', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'plan iets @Kandidaten emma' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect((textarea as HTMLTextAreaElement).value).toBe('plan iets ')
  })

  it('Tab picks the highlighted mention option while the menu is open', async () => {
    mockGet.mockImplementation((url: string) => url === '/candidates'
      ? Promise.resolve({ data: { data: [{ id: 'c-9', name: 'Emma Dekker' }] } })
      : Promise.resolve({ data: { data: [] } }))
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: '@emma' } })
    await waitFor(() => expect(screen.getAllByText('Emma Dekker').length).toBeGreaterThan(0))
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Tab' })
    expect((textarea as HTMLTextAreaElement).value).toContain('@Emma Dekker')
  })
})


