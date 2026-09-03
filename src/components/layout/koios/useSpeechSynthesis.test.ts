/**
 * useSpeechSynthesis — feature-detect gate, speak()/cancel() wiring and the
 * speaking-state lifecycle, plus the toSpeakableText markdown-stripping
 * helper (VOICE-MODE-1), against a stubbed window.speechSynthesis +
 * SpeechSynthesisUtterance (jsdom ships neither).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSpeechSynthesis, toSpeakableText } from './useSpeechSynthesis'

// Minimal utterance double: captures text/lang and lets the test fire the
// lifecycle callbacks the hook assigns, mirroring the real constructor shape.
class FakeUtterance {
  text: string
  lang = ''
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) { this.text = text }
}

describe('useSpeechSynthesis', () => {
  let speak: ReturnType<typeof vi.fn>
  let cancel: ReturnType<typeof vi.fn>

  // Stub both APIs the hook feature-detects against before each test.
  beforeEach(() => {
    speak = vi.fn()
    cancel = vi.fn()
    ;(window as unknown as { speechSynthesis: unknown }).speechSynthesis = { speak, cancel }
    ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance
  })

  afterEach(() => {
    delete (window as { speechSynthesis?: unknown }).speechSynthesis
    delete (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance
  })

  it('reports supported when both browser APIs exist', () => {
    const { result } = renderHook(() => useSpeechSynthesis())
    expect(result.current.supported).toBe(true)
  })

  it('reports unsupported when speechSynthesis is missing', () => {
    delete (window as { speechSynthesis?: unknown }).speechSynthesis
    const { result } = renderHook(() => useSpeechSynthesis())
    expect(result.current.supported).toBe(false)
  })

  it('speak() cancels any running utterance, then queues one with the given text and lang', () => {
    const { result } = renderHook(() => useSpeechSynthesis())
    const stripped = toSpeakableText('**Hello** world')
    act(() => { result.current.speak(stripped, 'en-US') })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(1)
    const utterance = speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.text).toBe('Hello world')
    expect(utterance.lang).toBe('en-US')
  })

  it('tracks speaking via the utterance lifecycle callbacks', () => {
    const { result } = renderHook(() => useSpeechSynthesis())
    act(() => { result.current.speak('hi', 'nl-NL') })
    const utterance = speak.mock.calls[0][0] as FakeUtterance
    act(() => { utterance.onstart?.() })
    expect(result.current.speaking).toBe(true)
    act(() => { utterance.onend?.() })
    expect(result.current.speaking).toBe(false)
  })

  it('cancel() stops speech immediately and resets speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis())
    act(() => { result.current.speak('hi', 'nl-NL') })
    const utterance = speak.mock.calls[0][0] as FakeUtterance
    act(() => { utterance.onstart?.() })
    act(() => { result.current.cancel() })
    expect(cancel).toHaveBeenCalledTimes(2) // once from speak()'s own cancel-first, once from cancel()
    expect(result.current.speaking).toBe(false)
  })
})

describe('toSpeakableText', () => {
  it('strips headings, emphasis, code, links and list markers', () => {
    expect(toSpeakableText('## Hi\n- **a**\n`x`\n[l](u)')).toBe('Hi a x l')
  })
})
