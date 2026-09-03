/**
 * koiosSpeechSupport — the shared, non-component pieces of the Web Speech API
 * surface (VOICE-MODE-1): the recognition-language table, the dictation
 * feature-detect helper, and the vendor-prefixed constructor typings. Split
 * out of KoiosVoiceButton.tsx so BOTH the mic component (dictation) and
 * useKoiosConversationMode (speech-out) import the exact same table/gate —
 * and so neither file exports non-component values from a component module
 * (react-hooks/react-refresh: fast refresh only works when a file only
 * exports components).
 */

// Minimal shape of the (still non-standard, vendor-prefixed) Web Speech API
// recognizer — lib.dom.d.ts ships the *event*/*result* types already but not
// the controller itself, so only the surface KoiosVoiceButton drives is declared.
export interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

// Chrome/Edge ship the constructor vendor-prefixed; Firefox/Safari<14.1 ship
// neither — both optional so the feature-detect below type-checks without `any`.
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

// i18n language → recognition locale. A dedicated table (not lib/i18n's
// LOCALE_BY_LANG, which maps 'en' to 'en-GB' for UI date formatting) — the
// spec asks for the US English acoustic/language model for dictation. Shared
// by KoiosVoiceButton (dictation IN) and useKoiosConversationMode (speech
// OUT), so both always agree on which language variant they speak.
export const RECOGNITION_LANG: Record<string, string> = {
  nl: 'nl-NL', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT',
}

// Feature-detect the Web Speech API constructor without a component instance
// — the conversation-mode toggle gates on this too, so it needs the exact
// same check KoiosVoiceButton's own render gate uses, without duplicating it.
export function isDictationSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
}
