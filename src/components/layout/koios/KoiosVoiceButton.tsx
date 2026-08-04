/**
 * KoiosVoiceButton — dictation mic for the Koios composer (SPEECH-1, Danny
 * 05-08: "Voice icon in Koios AI??"). Wraps the browser's Web Speech API
 * (SpeechRecognition ?? webkitSpeechRecognition) to turn spoken words into
 * draft text — the host (KoiosPanel) owns the textarea state, this component
 * only emits recognized chunks via `onText`; the caller appends + refocuses.
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
// spec asks for the US English acoustic/language model for dictation.
const RECOGNITION_LANG: Record<string, string> = {
  nl: 'nl-NL', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
}

interface KoiosVoiceButtonProps {
  // Called with each newly recognized text chunk. This component holds no
  // draft state — the host decides how to merge/append it and refocus.
  onText: (text: string) => void
  t: TFn
}

export default function KoiosVoiceButton({ onText, t }: KoiosVoiceButtonProps) {
  const { i18n } = useTranslation()
  const [listening, setListening] = useState(false)
  const [denied, setDenied] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Feature-detect once — the HONEST GATE. `undefined` means neither
  // constructor exists in this browser, so render() returns null below.
  const Ctor = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined

  // Never leave the mic hot: stop any live session on unmount (panel closed).
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // Rules of hooks: every hook above runs unconditionally; only the render
  // output is gated on browser support.
  if (!Ctor) return null

  // Stop the current session (user click or the effect cleanup) — idempotent.
  const stopListening = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  // Start a new single-utterance session: interim results stream in for a
  // live feel, `continuous: false` lets the browser auto-stop on silence.
  const startListening = () => {
    setDenied(false)
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = RECOGNITION_LANG[i18n.language] ?? 'en-US'

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
  const title = denied ? t('voice.denied', { ns: 'koios' })
    : listening ? t('voice.stop', { ns: 'koios' }) : t('voice.start', { ns: 'koios' })

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
          color: listening ? 'var(--color-danger)' : 'var(--sidebar-muted)',
          fontWeight: listening ? 600 : 400,
          display: 'flex', transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { if (!listening) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--color-primary)' } }}
        onMouseLeave={e => { if (!listening) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' } }}
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
