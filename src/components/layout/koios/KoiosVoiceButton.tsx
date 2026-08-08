/**
 * KoiosVoiceButton — dictation mic (SPEECH-1, Danny 05-08: "Voice icon in
 * Koios AI??"). Wraps the browser's Web Speech API (SpeechRecognition ??
 * webkitSpeechRecognition) to turn spoken words into draft text — the host
 * owns the destination text state, this component only emits recognized
 * chunks via `onText`; the caller appends + refocuses.
 *
 * TWO call sites share this ONE component (§11 one source; NOTITIE-VOICE-1
 * 06-08 — "de bouwsteen is er al, herbruik hem"): the Koios chat composer
 * (KoiosPanel, dictation language follows the active UI locale — its call
 * passes no `lang`, so this generalisation leaves it byte-identical) and the
 * note editor's mic (NoteComposer, dictation language follows the EDITOR's
 * OWN language picker via the `lang` prop — "dictatietaal = editortaal").
 * The mic+speech STATE MACHINE lives in `useSpeechDictation` below (§3: logic
 * in hooks) so both renders are driven by the exact same logic.
 *
 * HONEST GATE: renders nothing when neither constructor exists on `window`
 * (Firefox, Safari <14.1 today) — never a dead mic icon that does nothing on
 * click. Feature-detected once per mount, before any hook can early-return.
 *
 * FUTURE GATE: once CMBE ships the SPEECH-1 tenant setting (this is an
 * offerable feature, not on for every tenant by default), visibility here
 * will ALSO need to check that flag — today browser support is the only
 * gate; the host wires the tenant check once that setting lands.
 *
 * Scope note: this ships plain dictation-into-textarea only (click to start,
 * click again or silence-end to stop). A hands-free "conversation mode"
 * (auto-send + spoken replies) was raised mid-build via an unverified channel
 * and is deliberately NOT included here — it would need to own the send path
 * and message state, which this task did not grant, and needs Danny's direct
 * sign-off before it is built.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff } from 'lucide-react'
import type { TFn } from '@/types/koios'

// Minimal shape of the (still non-standard, vendor-prefixed) Web Speech API
// recognizer — lib.dom.d.ts ships the *event*/*result* types already but not
// the controller itself, so only the surface this component drives is declared.
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

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
// by both call sites — see the `lang` prop below for who supplies the key.
const RECOGNITION_LANG: Record<string, string> = {
  nl: 'nl-NL', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
}

/**
 * useSpeechDictation — the mic+speech STATE MACHINE, extracted so every call
 * site renders off the exact same logic (§11 one source; §3 logic in hooks).
 * Feature-detects the Web Speech API once, owns listening/denied state, and
 * exposes `toggle()`. `lang` (2-letter code) overrides the recognition
 * language derived from the active UI locale — omit it to keep the original
 * chat behaviour.
 */
function useSpeechDictation({ onText, lang }: { onText: (text: string) => void; lang?: string }) {
  const { i18n } = useTranslation()
  const [listening, setListening] = useState(false)
  const [denied, setDenied] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Feature-detect once — the HONEST GATE. `undefined` means neither
  // constructor exists in this browser, so the caller renders nothing.
  const Ctor = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined

  // Never leave the mic hot: stop any live session on unmount (panel/popup closed).
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // Stop the current session (user click or the effect cleanup) — idempotent.
  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  // Start a new single-utterance session: interim results stream in for a
  // live feel, `continuous: false` lets the browser auto-stop on silence.
  const startListening = () => {
    if (!Ctor) return
    setDenied(false)
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    // Caller-supplied language wins (e.g. the note editor's picker); else the
    // app's active UI locale — the chat composer's original behaviour.
    recognition.lang = RECOGNITION_LANG[lang ?? i18n.language] ?? 'en-US'

    // Only replay the segments THIS event changed (resultIndex..end) — replaying
    // the whole session on every interim revision would duplicate already-sent words.
    recognition.onresult = (event) => {
      let chunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        chunk += event.results[i][0].transcript
      }
      if (chunk) onText(chunk)
    }
    // A denied mic gets an honest title instead of a silently-dead button;
    // no-speech/aborted just stop quietly — nothing useful to tell the user.
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setDenied(true)
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const toggle = () => { if (listening) stopListening(); else startListening() }

  return { supported: Boolean(Ctor), listening, denied, toggle }
}

interface KoiosVoiceButtonProps {
  // Called with each newly recognized text chunk. This component holds no
  // draft state — the host decides how to merge/append it and refocus.
  onText: (text: string) => void
  t: TFn
  // Recognition language override (2-letter code: 'nl'/'en'/'de'/'fr'/'es').
  // Omit to follow the active UI locale (the chat composer's original,
  // unchanged behaviour) — NoteComposer passes its OWN language-picker value.
  lang?: string
  // Idle colour: 'muted' (chat composer default) or 'primary' — the note editor
  // toolbar wants the tenant accent (Danny 08-08 "met een tenant kleur").
  // Listening always shows the danger recording tint, whatever the tone.
  tone?: 'muted' | 'primary'
}

export default function KoiosVoiceButton({ onText, t, lang, tone = 'muted' }: KoiosVoiceButtonProps) {
  const { supported, listening, denied, toggle } = useSpeechDictation({ onText, lang })

  // Rules of hooks: every hook runs inside useSpeechDictation unconditionally;
  // only the render output is gated on browser support.
  if (!supported) return null

  const title = denied ? t('voice.denied', { ns: 'koios' })
    : listening ? t('voice.stop', { ns: 'koios' }) : t('voice.start', { ns: 'koios' })
  // Idle colour per tone; hover always previews the accent.
  const idleColor = tone === 'primary' ? 'var(--color-primary)' : 'var(--sidebar-muted)'

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={title}
        aria-label={title}
        aria-pressed={listening}
        className={listening ? 'km-koios-voice-pulse' : undefined}
        style={{
          // §4 soft-tint: active state = a stronger color-mix tint + bold, never a solid fill.
          background: listening ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)' : 'none',
          border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 7,
          color: listening ? 'var(--color-danger)' : idleColor,
          fontWeight: listening ? 600 : 400,
          display: 'flex', transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { if (!listening) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--color-primary)' } }}
        onMouseLeave={e => { if (!listening) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = idleColor } }}
      >
        {listening ? <MicOff size={14} /> : <Mic size={14} />}
      </button>
      {/* Subtle listening pulse — opacity only (§4), no new CSS file. */}
      <style>{`
        @keyframes km-koios-voice-pulse-kf { 0%,100%{opacity:1} 50%{opacity:0.55} }
        .km-koios-voice-pulse { animation: km-koios-voice-pulse-kf 1.4s ease-in-out infinite; }
      `}</style>
    </>
  )
}
