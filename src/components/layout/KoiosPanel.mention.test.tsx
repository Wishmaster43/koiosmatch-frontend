/** KoiosPanel · mention menu, landing cards and initial question (split from KoiosPanel.test.tsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// KOIOS-LOCALE-1: the panel sends the UI language (read from <html lang>) as the 8th
// sendChat argument; pin it so every request assertion below proves the seam.
beforeEach(() => { document.documentElement.lang = 'en' })
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPanel from './KoiosPanel'
import { sendChat } from './koios/koiosApi'
import api from '@/lib/api'
import { SelectionProvider } from '@/context/SelectionContext'

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
// "+ Nieuw" feedback (KOIOS-SUGGEST-COMPACT-2) — spy on the toast, no real DOM event plumbing.
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notify: vi.fn() }))

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
// VOICE-SETTINGS-1: the user's own ui_preferences.koios_voice blob, switchable per test
// (useKoiosVoicePreference reads this via the real useUserPreference, off `user`).
const voicePrefModule = vi.hoisted(() => ({ ui_preferences: null as Record<string, unknown> | null }))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: () => true,
    hasModule: (m: string) => (m === 'speech' ? speechModule.enabled : true),
    user: { ui_preferences: voicePrefModule.ui_preferences },
    refreshUser: () => {},
  }),
}))
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

