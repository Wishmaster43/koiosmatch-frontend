/**
 * KoiosVoiceButton — the HONEST GATE (render nothing without browser support)
 * and the SECURE-CONTEXT GATE (render disabled without https) are the
 * load-bearing behaviours here, plus the start/stop/append contract, the
 * per-error-code notifyError surface, and the interim-result dedup guard —
 * all against a mocked SpeechRecognition (jsdom ships neither the real API
 * nor the vendor-prefixed one).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosVoiceButton from './KoiosVoiceButton'
import { notifyError } from '@/lib/notify'

// Spy on the toast dispatcher so onerror-visibility assertions don't depend
// on a real <Toaster> being mounted (§13 — assert the actual call, not a side effect).
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))

// t() just echoes the key here (no i18n init in this test) — good enough to
// assert the accessible name is wired, not to check the translated copy.
const t = ((key: string) => key) as unknown as (key: string, opts?: Record<string, unknown>) => string

// Minimal recognizer double: captures the handlers the component assigns so
// a test can fire them directly, and spies on start/stop.
interface MockResultAlt { transcript: string }
interface MockResult extends Array<MockResultAlt> { isFinal: boolean }
interface MockResultEvent { resultIndex: number; results: MockResult[] }

// The real SpeechRecognitionResult is an array-like of alternatives WITH an
// `isFinal` flag — the component only reads FINAL segments (interim text is the
// recognizer thinking out loud), so the double must carry that flag too.
const seg = (transcript: string, isFinal = true): MockResult =>
  Object.assign([{ transcript }], { isFinal }) as MockResult
interface MockErrorEvent { error: string }
class MockSpeechRecognition {
  static lastInstance: MockSpeechRecognition | null = null
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((e: MockResultEvent) => void) | null = null
  onerror: ((e: MockErrorEvent) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn(() => { this.onend?.() })
  constructor() { MockSpeechRecognition.lastInstance = this }
}

describe('KoiosVoiceButton', () => {
  afterEach(() => {
    delete (window as { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  // HONEST GATE: neither constructor present → render nothing, never a dead mic.
  it('renders nothing when the browser has no SpeechRecognition support', () => {
    const { container } = render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
    expect(container).toBeEmptyDOMElement()
  })

  describe('with a mocked SpeechRecognition', () => {
    beforeEach(() => {
      MockSpeechRecognition.lastInstance = null
      window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
      vi.mocked(notifyError).mockClear()
    })

    // SECURE-CONTEXT GATE: the constructor exists but the browser reports an
    // insecure origin — render a DISABLED mic with an honest tooltip, never a
    // live-looking button that silently does nothing on click.
    describe('in an insecure context', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
      })
      afterEach(() => {
        Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
      })

      it('renders a disabled mic with the https-required tooltip, and never starts a session', async () => {
        const user = userEvent.setup()
        render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
        const button = screen.getByRole('button')
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('title', 'voice.insecureContext')
        expect(button).toHaveAttribute('aria-label', 'voice.insecureContext')
        // A disabled native <button> ignores clicks — recognition never starts.
        await user.click(button)
        expect(MockSpeechRecognition.lastInstance).toBeNull()
      })
    })

    it('starts listening on click, appends a result via onText, and stops on a second click', async () => {
      const onText = vi.fn()
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={onText} t={t} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-pressed', 'false')

      // First click starts a session.
      await user.click(button)
      expect(MockSpeechRecognition.lastInstance?.start).toHaveBeenCalledTimes(1)
      expect(button).toHaveAttribute('aria-pressed', 'true')

      // A FINAL recognition result flows through onText verbatim (resultIndex..end).
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('hello world')] })
      expect(onText).toHaveBeenCalledWith('hello world')

      // Second click stops the session.
      await user.click(button)
      expect(MockSpeechRecognition.lastInstance?.stop).toHaveBeenCalledTimes(1)
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('derives the recognition language from the active i18n locale', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      // No i18n instance is initialised in this test, so i18n.language is falsy
      // and the button falls back to its default recognition locale.
      expect(MockSpeechRecognition.lastInstance?.lang).toBe('en-US')
    })

    // NOTITIE-VOICE-1: the note editor's mic must dictate in the EDITOR's own
    // language, not the UI locale — the optional `lang` prop overrides the table
    // lookup. The chat composer never passes it, so its own behaviour (above) stays.
    it('honours an explicit `lang` override over the active i18n locale', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} lang="nl" />)
      await user.click(screen.getByRole('button'))
      expect(MockSpeechRecognition.lastInstance?.lang).toBe('nl-NL')
    })

    it('falls back to en-US for an unmapped `lang` override', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} lang="xx" />)
      await user.click(screen.getByRole('button'))
      expect(MockSpeechRecognition.lastInstance?.lang).toBe('en-US')
    })

    // FINAL-ONLY (Danny live 08-08: the note filled with "te / st / te / st").
    // Interim guesses are revisions in progress — emitting them appended half
    // words as their own paragraphs. Only the finalised segment may reach onText.
    it('ignores interim guesses and emits only the finalised segment', async () => {
      const onText = vi.fn()
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={onText} t={t} />)
      await user.click(screen.getByRole('button'))

      // The recognizer thinking out loud: "te" → "tes" → "test" (all interim).
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('te', false)] })
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('tes', false)] })
      expect(onText).not.toHaveBeenCalled()

      // Only when it commits does the text land — once, whole.
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('test')] })
      expect(onText).toHaveBeenCalledTimes(1)
      expect(onText).toHaveBeenCalledWith('test')
    })

    // A genuinely NEW segment (advancing resultIndex, e.g. the prior one
    // finalized) is not a revision — the full new chunk is emitted as-is.
    it('emits the full chunk for a new resultIndex, not a diff against the previous segment', async () => {
      const onText = vi.fn()
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={onText} t={t} />)
      await user.click(screen.getByRole('button'))

      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('hello world')] })
      MockSpeechRecognition.lastInstance?.onresult?.({
        resultIndex: 1,
        results: [seg('hello world'), seg('goodbye')],
      })

      expect(onText).toHaveBeenNthCalledWith(1, 'hello world')
      expect(onText).toHaveBeenNthCalledWith(2, 'goodbye')
    })

    it('resets the dedup state on a new session (no stale suffix from a prior utterance)', async () => {
      const onText = vi.fn()
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={onText} t={t} />)

      // First session: interim "hello" then stop.
      await user.click(screen.getByRole('button'))
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('hello')] })
      await user.click(screen.getByRole('button'))

      // Second session reuses resultIndex 0 — must NOT be treated as a revision
      // of the previous session's "hello".
      await user.click(screen.getByRole('button'))
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [seg('goodbye')] })

      expect(onText).toHaveBeenNthCalledWith(1, 'hello')
      expect(onText).toHaveBeenNthCalledWith(2, 'goodbye')
    })

    it('stops quietly on a no-speech error, without the denied title or a toast', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'no-speech' }) })
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(button).toHaveAttribute('title', 'voice.start')
      expect(notifyError).not.toHaveBeenCalled()
    })

    it('stops quietly on an aborted error, without a toast', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'aborted' }) })
      expect(notifyError).not.toHaveBeenCalled()
    })

    it('shows the honest denied title and a toast on a not-allowed error', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'not-allowed' }) })
      expect(screen.getByRole('button')).toHaveAttribute('title', 'voice.denied')
      expect(notifyError).toHaveBeenCalledWith('voice.denied')
    })

    it('shows the denied title and a distinct toast on a service-not-allowed error', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'service-not-allowed' }) })
      expect(screen.getByRole('button')).toHaveAttribute('title', 'voice.denied')
      expect(notifyError).toHaveBeenCalledWith('voice.errorServiceNotAllowed')
    })

    it('surfaces a toast without the denied title on an audio-capture error', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'audio-capture' }) })
      expect(screen.getByRole('button')).toHaveAttribute('title', 'voice.start')
      expect(notifyError).toHaveBeenCalledWith('voice.errorAudioCapture')
    })

    it('surfaces a toast without the denied title on a network error', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'network' }) })
      expect(screen.getByRole('button')).toHaveAttribute('title', 'voice.start')
      expect(notifyError).toHaveBeenCalledWith('voice.errorNetwork')
    })

    it('falls back to a generic toast for an unmapped error code', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'bad-grammar' }) })
      expect(notifyError).toHaveBeenCalledWith('voice.errorGeneric')
    })
  })
})

// HOLD-OPEN (Danny 08-08: "dictee stopt te snel, ik moet aan en uit zelf
// bepalen"). The session must survive the browser's own silence-timeout and
// end ONLY when the user clicks the mic off.
describe('KoiosVoiceButton · the user decides when dictation ends', () => {
  // Same install/teardown as the sibling suite above — the component renders
  // nothing without a recognizer on window.
  beforeEach(() => {
    MockSpeechRecognition.lastInstance = null
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition
  })
  afterEach(() => { delete (window as { SpeechRecognition?: unknown }).SpeechRecognition })

  it('asks the recognizer to keep listening across pauses', async () => {
    const user = userEvent.setup()
    render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
    await user.click(screen.getByRole('button'))
    expect(MockSpeechRecognition.lastInstance?.continuous).toBe(true)
  })

  it('resumes when the browser ends the session on its own, and stays "listening"', async () => {
    const user = userEvent.setup()
    render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
    const button = screen.getByRole('button')
    await user.click(button)
    const rec = MockSpeechRecognition.lastInstance!
    expect(rec.start).toHaveBeenCalledTimes(1)

    // The browser cuts off after a long silence — not the user.
    act(() => { rec.onend?.() })
    expect(rec.start).toHaveBeenCalledTimes(2)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays stopped once the USER clicks it off', async () => {
    const user = userEvent.setup()
    render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
    const button = screen.getByRole('button')
    await user.click(button)
    const rec = MockSpeechRecognition.lastInstance!
    await user.click(button)

    // A trailing onend from the stopped session must not revive it.
    act(() => { rec.onend?.() })
    expect(rec.start).toHaveBeenCalledTimes(1)
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })
})
