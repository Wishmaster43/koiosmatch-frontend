/**
 * useKoiosVoicePreference — VOICE-SETTINGS-1: the per-user Koios voice
 * settings (mic on/off, dictation language, read-aloud on/off, picked local
 * voice), persisted via the shared `useUserPreference` (PUT /auth/me
 * `ui_preferences.koios_voice`, §8 no remote voice ever leaves the browser).
 * Tolerant read: a stored object missing a field falls back per field, and a
 * non-object stored value falls back to the whole default (a prior, shape-
 * incompatible value must never crash the profile tab).
 */
import { useCallback } from 'react'
import { useUserPreference } from './useUserPreference'
import { RECOGNITION_LANG } from '@/components/layout/koios/koiosSpeechSupport'

export type KoiosVoiceLanguage = 'auto' | 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'pt'

export interface KoiosVoicePreference {
  input: boolean
  language: KoiosVoiceLanguage
  readAloud: boolean
  voiceName: string | null
}

export const KOIOS_VOICE_DEFAULTS: KoiosVoicePreference = {
  input: true,
  language: 'auto',
  readAloud: false,
  voiceName: null,
}

// Per-field tolerant merge: a stored blob from before a field existed (or a
// half-written patch) must still yield every field, never `undefined`.
function normalize(stored: unknown): KoiosVoicePreference {
  if (!stored || typeof stored !== 'object') return KOIOS_VOICE_DEFAULTS
  const raw = stored as Partial<KoiosVoicePreference>
  return {
    input: typeof raw.input === 'boolean' ? raw.input : KOIOS_VOICE_DEFAULTS.input,
    language: typeof raw.language === 'string' ? (raw.language as KoiosVoiceLanguage) : KOIOS_VOICE_DEFAULTS.language,
    readAloud: typeof raw.readAloud === 'boolean' ? raw.readAloud : KOIOS_VOICE_DEFAULTS.readAloud,
    voiceName: typeof raw.voiceName === 'string' ? raw.voiceName : KOIOS_VOICE_DEFAULTS.voiceName,
  }
}

// 'auto' follows the active UI language; any other stored value passes through.
export function resolveDictationLang(pref: KoiosVoicePreference, uiLanguage: string): string {
  return pref.language === 'auto' ? uiLanguage : pref.language
}

// Only LOCAL voices (§8: an answer must never be sent to a remote voice
// service) whose lang tag matches the resolved dictation language's own
// RECOGNITION_LANG entry (e.g. 'nl' -> 'nl-NL' -> voices whose lang starts with 'nl').
export function localVoicesFor(voices: SpeechSynthesisVoice[], langCode: string): SpeechSynthesisVoice[] {
  const tag = RECOGNITION_LANG[langCode] ?? langCode
  const langPrefix = tag.split('-')[0]
  return voices.filter(v => v.localService === true && v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()))
}

// One preference, one hook: reads the raw `koios_voice` key and returns a
// normalized value plus a patch setter that merges onto the CURRENT normalized
// value (never a stale closure — useUserPreference's own `next` already carries the merge).
export function useKoiosVoicePreference(): [KoiosVoicePreference, (patch: Partial<KoiosVoicePreference>) => void] {
  const [raw, setRaw] = useUserPreference<unknown>('koios_voice', KOIOS_VOICE_DEFAULTS)
  const pref = normalize(raw)
  // Merges onto `raw` freshly normalized inside the callback (not the outer `pref`
  // const), so the dependency array only needs `raw`/`setRaw` — no exhaustive-deps disable.
  const patch = useCallback((next: Partial<KoiosVoicePreference>) => {
    setRaw({ ...normalize(raw), ...next })
  }, [setRaw, raw])
  return [pref, patch]
}
