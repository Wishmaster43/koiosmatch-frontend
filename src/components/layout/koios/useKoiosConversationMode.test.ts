/**
 * useKoiosConversationMode — VOICE-SETTINGS-1 additions: the `readAloud`
 * preference speaks the newest assistant answer independently of the
 * hands-free `voiceMode` toggle, passes the picked `voiceName` through, and
 * NEVER triggers the auto-send-after-dictation behaviour (that stays tied to
 * voiceMode alone).
 */
import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useKoiosConversationMode } from './useKoiosConversationMode'
import type { KoiosChatMessage } from '@/types/koios'

const speak = vi.fn()
vi.mock('./useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({ supported: true, speaking: false, speak, cancel: vi.fn() }),
  toSpeakableText: (a: string) => a,
}))
vi.mock('./koiosSpeechSupport', () => ({
  isDictationSupported: () => true,
  RECOGNITION_LANG: { nl: 'nl-NL', en: 'en-US' },
}))

function withAnswer(answer: string): KoiosChatMessage[] {
  return [{ role: 'assistant', answer } as KoiosChatMessage]
}

describe('useKoiosConversationMode · readAloud', () => {
  beforeEach(() => vi.clearAllMocks())

  it('speaks the newest assistant answer with the picked voice when readAloud is on, voiceMode off', () => {
    renderHook(() => useKoiosConversationMode({
      voiceMode: false, open: true, locale: 'nl-NL', input: '', submit: vi.fn(),
      messages: withAnswer('Hallo daar.'), readAloud: true, voiceName: 'Google NL',
    }))
    expect(speak).toHaveBeenCalledWith('Hallo daar.', 'nl-NL', 'Google NL')
  })

  it('speaks nothing when both voiceMode and readAloud are off', () => {
    renderHook(() => useKoiosConversationMode({
      voiceMode: false, open: true, locale: 'nl-NL', input: '', submit: vi.fn(),
      messages: withAnswer('Stil.'), readAloud: false, voiceName: null,
    }))
    expect(speak).not.toHaveBeenCalled()
  })

  it('speaks nothing into a closed panel even with readAloud on', () => {
    renderHook(() => useKoiosConversationMode({
      voiceMode: false, open: false, locale: 'nl-NL', input: '', submit: vi.fn(),
      messages: withAnswer('Niet horen.'), readAloud: true, voiceName: null,
    }))
    expect(speak).not.toHaveBeenCalled()
  })

  it('never auto-sends after dictation when only readAloud is on', () => {
    const submit = vi.fn()
    const { result } = renderHook(() => useKoiosConversationMode({
      voiceMode: false, open: true, locale: 'nl-NL', input: 'dictated text', submit,
      messages: [], readAloud: true, voiceName: null,
    }))
    result.current.onDictationEnd()
    expect(submit).not.toHaveBeenCalled()
  })
})
