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
  // K-147: the effort picker reads /ai/koios/capabilities — answer it with a supported
  // scale so the toolbar control renders; every other GET stays the empty list.
  return { ...actual, default: { get: vi.fn((url: string) => Promise.resolve(url === '/ai/koios/capabilities'
    ? { data: { data: { effort: { supported: true, options: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'high', max: 'max' } } } }
    : { data: { data: [] } })) } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>
// No AuthProvider wraps this test tree, and useAuth()'s default context value
// is `null` — koiosMentionAccess.isCategoryVisible would then hide EVERY
// permission-gated category, leaving the mention menu empty. Full access, same
// stub shape as KoiosMentionMenu.test.tsx's own auth stub.
// SPEECH-1: the `speech` add-on gates the mic + conversation mode; switchable per test.
const speechModule = vi.hoisted(() => ({ enabled: true }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true, hasModule: (m: string) => (m === 'speech' ? speechModule.enabled : true) }) }))

// Landing state (Danny 21/7): the radar REPLACES the old feature-list welcome, and only
// while no real conversation has started yet. Danny 09-09 (point 1): the one-line
// personal greeting ("Hoi Kelly, wat kan ik voor je doen?") opens the landing above it.
describe('KoiosPanel — landing state', () => {
  it('shows the one-line greeting and the Koios Advies radar when opened', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    expect(screen.getByText('common:koios.radar.title')).toBeInTheDocument()
    // The mocked auth has no user, so the anonymous variant renders — one line, no feature list.
    expect(screen.getByText(/koios\.welcome(Anonymous)?/)).toBeInTheDocument()
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
    ]), null, null, false))
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
    await waitFor(() => expect(sendChat).toHaveBeenCalledWith('hello', null, [], null, null, false))
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


// KOIOS-ADVIES-DOORKLIK-1: when the panel is passed an initialQuestion (from an
// advice row via the bridge), it prefills the composer and calls the consumed callback.
describe('KoiosPanel · initial question (advice link)', () => {
  it('shows the initialQuestion in the composer and calls onInitialQuestionConsumed once', async () => {
    const onConsumed = vi.fn()
    renderWithQuery(
      <KoiosPanel
        open
        initialQuestion="Vraag X"
        onInitialQuestionConsumed={onConsumed}
        onClose={() => {}}
        onNavigate={() => {}}
      />,
    )
    await screen.findByText('common:koios.radar.empty')
    // The question text now fills the textarea
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder') as HTMLTextAreaElement
    expect(textarea.value).toBe('Vraag X')
    // The callback fired once on mount
    expect(onConsumed).toHaveBeenCalledTimes(1)
  })

  it('adds initialContextRef to the context chips when provided', async () => {
    const contextRef = { type: 'candidate', id: 'c-99', label: 'Piet Jansen' }
    renderWithQuery(
      <KoiosPanel
        open
        initialQuestion="Help met deze kandidaat"
        initialContextRef={contextRef}
        onInitialQuestionConsumed={() => {}}
        onClose={() => {}}
        onNavigate={() => {}}
      />,
    )
    await screen.findByText('common:koios.radar.empty')
    // The ref appears as a removable chip
    expect(screen.getByRole('button', { name: 'remove Piet Jansen' })).toBeInTheDocument()
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

// K-147 (Danny 2026-09-02): per-message effort override.
describe('KoiosPanel · effort picker', () => {
  // The shared mockGet was reset by an earlier block; answer the capabilities call
  // again here so the capabilities-driven picker renders (supported, ceiling max).
  beforeEach(() => {
    mockGet.mockReset()
    mockGet.mockImplementation((url: string) => Promise.resolve(url === '/ai/koios/capabilities'
      ? { data: { data: { effort: { supported: true, options: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'high', max: 'max' } } } }
      : { data: { data: [] } }))
  })
  it('renders the effort selector in the toolbar', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect(await screen.findByText('koios.effort.defaultWith')).toBeInTheDocument()
  })

  it('sends effort in the request body when set to a non-default value', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({ answer: 'Reply at high effort.', steps: [] })
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    // Click the effort picker and select "Hoog" (high)
    const effortButtons = await screen.findAllByText('koios.effort.defaultWith')
    const effortButton = effortButtons[effortButtons.length - 1]
    fireEvent.click(effortButton)
    await waitFor(() => {
      const highOption = screen.getByText('koios.effort.high')
      expect(highOption).toBeInTheDocument()
      fireEvent.click(highOption)
    })
    // Now send a message
    fireEvent.change(textarea, { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await waitFor(() => expect(sendChat).toHaveBeenCalled())
    // Check the call carried effort: 'high'
    expect(sendChat).toHaveBeenCalledWith('test', null, [], null, 'high', false)
  })

  it('does not send effort in the request body when set to default', async () => {
    vi.mocked(sendChat).mockResolvedValueOnce({ answer: 'Reply at default.', steps: [] })
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    // Keep effort at default (unset)
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await waitFor(() => expect(sendChat).toHaveBeenCalled())
    // Check the call carried effort: null (5th arg after model/context/flavor)
    expect(sendChat).toHaveBeenCalledWith('hello', null, [], null, null, false)
  })

  it('the effort trigger is named by its label AND its current value (§6)', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const trigger = await screen.findByRole('button', { name: /koios\.effort\.label.*koios\.effort\.defaultWith/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
  })
})

// VOICE-MODE-1: conversation mode (auto-send after dictation + spoken
// answers). Every test stubs window.SpeechRecognition/speechSynthesis
// (jsdom ships neither) and reuses the module-level sendChat mock — never a
// live /ai/koios/* call (API-CREDITS-1).
describe('KoiosPanel · conversation mode (VOICE-MODE-1)', () => {
  // Minimal recognizer double — only needs to exist for the feature-detect
  // check; no test here actually dictates.
  class MockSpeechRecognition {
    continuous = false
    interimResults = false
    lang = ''
    onresult: (() => void) | null = null
    onerror: (() => void) | null = null
    onend: (() => void) | null = null
    start = vi.fn()
    stop = vi.fn()
  }
  // Minimal utterance double — captures text/lang so tests can assert on it.
  class FakeUtterance {
    text: string
    lang = ''
    onstart: (() => void) | null = null
    onend: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor(text: string) { this.text = text }
  }
  let speak: ReturnType<typeof vi.fn>
  let cancel: ReturnType<typeof vi.fn>

  // Stub both browser APIs the conversation-mode toggle gates on.
  function stubVoiceApis() {
    speak = vi.fn()
    cancel = vi.fn()
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockSpeechRecognition
    ;(window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak, cancel }
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance
  }

  afterEach(() => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as { speechSynthesis?: unknown }).speechSynthesis
    delete (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance
    vi.mocked(sendChat).mockClear()
  })

  // (a) no browser support at all → the toggle is not offered.
  it('does not render the conversation-mode toggle without speechSynthesis/SpeechRecognition support', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect(screen.queryByRole('button', { name: 'voice.conversationMode' })).toBeNull()
  })

  // (b) both APIs stubbed → the toggle renders with its accessible name.
  it('renders the conversation-mode toggle once both dictation and speech-synthesis are supported', async () => {
    stubVoiceApis()
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect(screen.getByRole('button', { name: 'voice.conversationMode' })).toBeInTheDocument()
  })

  // SPEECH-1 (BE bundle MISC Lane D): without the `speech` add-on neither the mic nor
  // the conversation-mode toggle renders, browser support or not.
  it('hides the mic and the conversation-mode toggle when the tenant lacks the speech add-on', async () => {
    stubVoiceApis(); speechModule.enabled = false
    try {
      renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
      await screen.findByText('common:koios.radar.empty')
      expect(screen.queryByRole('button', { name: 'voice.conversationMode' })).toBeNull()
      expect(screen.queryByRole('button', { name: /voice\.(start|stop|dictate)/ })).toBeNull()
    } finally { speechModule.enabled = true }
  })

  // (c) switching the toggle on and sending a message sends voice_mode: true.
  it('sends voiceMode=true to sendChat once the toggle is switched on', async () => {
    stubVoiceApis()
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    fireEvent.click(screen.getByRole('button', { name: 'voice.conversationMode' }))
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await waitFor(() => expect(sendChat).toHaveBeenCalledWith('hello', null, [], null, null, true))
  })

  // (d) with the mode on, the reply is read aloud exactly once.
  it('speaks the assistant reply once conversation mode is on', async () => {
    stubVoiceApis()
    vi.mocked(sendChat).mockResolvedValueOnce({ answer: 'Plain reply.', steps: [] })
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    fireEvent.click(screen.getByRole('button', { name: 'voice.conversationMode' }))
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await screen.findByText('Plain reply.')
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1))
    const utterance = speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.text).toBe('Plain reply.')
  })

  // (e) with the mode off, the same reply is never spoken.
  it('does not speak the assistant reply when conversation mode is off', async () => {
    stubVoiceApis()
    vi.mocked(sendChat).mockResolvedValueOnce({ answer: 'Silent reply.', steps: [] })
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'koios.taskPlaceholder' }))
    await screen.findByText('Silent reply.')
    expect(speak).not.toHaveBeenCalled()
  })
})



describe('KoiosPanel — composer footer (Danny 09-09: "weg met die tekst")', () => {
  // The keyboard hint and the About Koios AI link no longer render under the composer;
  // the transparency page stays reachable under Instellingen → Koios AI.
  it('renders neither the input hint nor the about link', async () => {
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect(screen.queryByText('koios.inputHint')).toBeNull()
    expect(screen.queryByText('koios.aboutLink')).toBeNull()
  })
})
