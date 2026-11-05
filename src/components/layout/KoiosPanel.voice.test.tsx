/** KoiosPanel · effort picker, conversation mode, composer footer and new-chat feedback (split from KoiosPanel.test.tsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// KOIOS-LOCALE-1: the panel sends the UI language (read from <html lang>) as the 8th
// sendChat argument; pin it so every request assertion below proves the seam.
beforeEach(() => { document.documentElement.lang = 'en' })
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KoiosPanel from './KoiosPanel'
import { sendChat } from './koios/koiosApi'
import api from '@/lib/api'

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
    expect(sendChat).toHaveBeenCalledWith('test', null, [], null, 'high', false, undefined, 'en')
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
    expect(sendChat).toHaveBeenCalledWith('hello', null, [], null, null, false, undefined, 'en')
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

  // VOICE-SETTINGS-1: the mic is hidden entirely once the user's own
  // preference switches input off, independent of browser support.
  it('hides the mic when the user switched off speech input in their preference', async () => {
    stubVoiceApis()
    voicePrefModule.ui_preferences = { koios_voice: { input: false } }
    try {
      renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
      await screen.findByText('common:koios.radar.empty')
      expect(screen.queryByRole('button', { name: /voice\.(start|stop)/ })).toBeNull()
    } finally { voicePrefModule.ui_preferences = null }
  })

  it('renders the mic with default preferences (no ui_preferences saved yet)', async () => {
    stubVoiceApis()
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    expect(screen.getByRole('button', { name: /voice\.(start|stop)/ })).toBeInTheDocument()
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
    await waitFor(() => expect(sendChat).toHaveBeenCalledWith('hello', null, [], null, null, true, undefined, 'en'))
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

// KOIOS-SUGGEST-COMPACT-2 (Danny 28-09: "+ nieuw icon doet niets!!"): "+ Nieuw"
// always gives visible feedback — a toast on the empty landing state (nothing
// to visibly reset), none once a real thread gets reset (the reset itself is
// the feedback).
describe('KoiosPanel · "+ Nieuw" always gives feedback', () => {
  beforeEach(async () => { const { notifySuccess } = await import('@/lib/notify'); vi.mocked(notifySuccess).mockClear() })

  it('toasts on the empty landing state (nothing to reset)', async () => {
    const { notifySuccess } = await import('@/lib/notify')
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    fireEvent.click(screen.getByRole('button', { name: 'koios.newChatShort' }))
    expect(notifySuccess).toHaveBeenCalledWith('koios.newChatReady')
    // The composer itself gets focus (setTimeout(50)) so typing can start right away.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByPlaceholderText('koios.taskPlaceholder')))
  })

  it('fires no toast once a real thread gets reset (the reset itself is the feedback)', async () => {
    const { notifySuccess } = await import('@/lib/notify')
    vi.mocked(sendChat).mockResolvedValueOnce({ answer: 'Hoi!', steps: [] })
    renderWithQuery(<KoiosPanel open onClose={() => {}} onNavigate={() => {}} />)
    await screen.findByText('common:koios.radar.empty')
    const textarea = screen.getByPlaceholderText('koios.taskPlaceholder')
    fireEvent.change(textarea, { target: { value: 'hallo' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    await waitFor(() => expect(sendChat).toHaveBeenCalled())
    await screen.findByText('Hoi!')
    fireEvent.click(screen.getByRole('button', { name: 'koios.newChatShort' }))
    expect(notifySuccess).not.toHaveBeenCalled()
  })
})
