/**
 * KoiosVoiceButton — the HONEST GATE (render nothing without browser support)
 * is the load-bearing behaviour here, plus the start/stop/append contract
 * against a mocked SpeechRecognition (jsdom ships neither the real API nor
 * the vendor-prefixed one).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KoiosVoiceButton from './KoiosVoiceButton'

// t() just echoes the key here (no i18n init in this test) — good enough to
// assert the accessible name is wired, not to check the translated copy.
const t = ((key: string) => key) as unknown as (key: string, opts?: Record<string, unknown>) => string

// Minimal recognizer double: captures the handlers the component assigns so
// a test can fire them directly, and spies on start/stop.
interface MockResultEvent { resultIndex: number; results: Array<Array<{ transcript: string }>> }
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

      // A recognition result flows through onText verbatim (resultIndex..end).
      MockSpeechRecognition.lastInstance?.onresult?.({ resultIndex: 0, results: [[{ transcript: 'hello world' }]] })
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

    it('stops quietly on a no-speech error, without the denied title', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'no-speech' }) })
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(button).toHaveAttribute('title', 'voice.start')
    })

    it('shows the honest denied title on a not-allowed error', async () => {
      const user = userEvent.setup()
      render(<KoiosVoiceButton onText={vi.fn()} t={t} />)
      await user.click(screen.getByRole('button'))
      act(() => { MockSpeechRecognition.lastInstance?.onerror?.({ error: 'not-allowed' }) })
      expect(screen.getByRole('button')).toHaveAttribute('title', 'voice.denied')
    })
  })
})
