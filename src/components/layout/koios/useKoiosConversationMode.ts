/**
 * useKoiosConversationMode — VOICE-MODE-1: owns everything Koios' hands-free
 * conversation mode needs beyond the plain `voiceMode` flag (which lives in
 * useKoiosChat, since it also has to reach `sendChat`'s `voice_mode` body key).
 * This hook covers the browser feature gate (both Web Speech APIs must exist),
 * auto-send after a dictation session, and speaking the newest assistant
 * answer aloud exactly once — split out so KoiosPanel stays the thin
 * composition layer (§3, file-size discipline).
 */
import { useEffect, useRef } from 'react'
import { useSpeechSynthesis, toSpeakableText } from './useSpeechSynthesis'
import { isDictationSupported, RECOGNITION_LANG } from './koiosSpeechSupport'
import type { KoiosChatMessage } from '@/types/koios'

interface UseKoiosConversationModeArgs {
  voiceMode: boolean
  open?: boolean
  // BCP-47-ish UI locale tag (useLocale(), e.g. 'nl-NL') — mapped down to the
  // same RECOGNITION_LANG table the mic uses, so speech and dictation always
  // agree on which language variant they speak.
  locale: string
  input: string
  submit: (text?: string) => void
  messages: KoiosChatMessage[]
}

// Wires the feature gate, auto-send-on-dictation-end, and speak-the-latest-
// answer effect around the shared useSpeechSynthesis hook. Destructured (not
// held as one `tts` object) so `speak`/`cancel` — stable useCallback
// references inside useSpeechSynthesis — can sit directly in dependency
// arrays below, with no exhaustive-deps disable needed.
export function useKoiosConversationMode({ voiceMode, open, locale, input, submit, messages }: UseKoiosConversationModeArgs) {
  const { supported, speaking, speak, cancel } = useSpeechSynthesis()
  // The toggle is only offered when BOTH browser APIs exist.
  const available = isDictationSupported() && supported

  // Latest draft in a ref so KoiosVoiceButton's onEnd (a stable callback,
  // wired once per session) never auto-sends a stale closure's draft text.
  const inputRef = useRef(input)
  useEffect(() => { inputRef.current = input })

  // Fires once a dictation session ends with real text captured — auto-send
  // only while conversation mode is on and the draft actually has content.
  const onDictationEnd = () => {
    if (voiceMode && inputRef.current.trim()) submit(inputRef.current)
  }

  // Speak the newest assistant answer once, tracked by message index so a
  // re-render never repeats it and switching the mode back on mid-conversation
  // never replays an answer that was already read out (or never spoken at all).
  const spokenIndexRef = useRef(-1)
  useEffect(() => {
    if (!voiceMode) return
    const lastIndex = messages.length - 1
    const last = messages[lastIndex]
    if (!last || last.role !== 'assistant' || !last.answer) return
    if (spokenIndexRef.current === lastIndex) return
    spokenIndexRef.current = lastIndex
    const lang = RECOGNITION_LANG[locale.split('-')[0]] ?? 'en-US'
    speak(toSpeakableText(last.answer), lang)
  }, [messages, voiceMode, locale, speak])

  // Cancel any running speech the moment the panel closes or the mode is
  // switched off — Koios must never keep talking into a closed/silent panel.
  useEffect(() => {
    if (!open || !voiceMode) cancel()
  }, [open, voiceMode, cancel])

  return { available, speaking, onDictationEnd }
}
