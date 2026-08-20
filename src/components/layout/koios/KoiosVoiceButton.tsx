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
 * SECURE-CONTEXT GATE (Danny 08-08: "ik geef de mic toestemming maar tekst
 * komt niet in het blok"): the Web Speech API is spec-restricted to a SECURE
 * CONTEXT (https or localhost). Served over plain http the constructor still
 * exists on `window`, so the mic looks live, but the browser silently blocks
 * recognition even after the user clicks "allow" on the permission prompt —
 * a dead-affordance trap. This is caught separately from the HONEST GATE
 * above: an unsupported browser renders nothing, an insecure context renders
 * a DISABLED mic with an honest tooltip (§3 — no fake affordances).
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
import { notifyError } from '@/lib/notify'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'

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
  const { t, i18n } = useTranslation()
  const [listening, setListening] = useState(false)
  const [denied, setDenied] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // Tracks the last-emitted (index, text) pair so a revised interim result
  // (same index, growing transcript) only sends the NEW suffix — see onresult below.
  const lastEmittedRef = useRef<{ index: number; text: string }>({ index: -1, text: '' })
  // True only when the USER ended the session (click / unmount) — an `onend`
  // fired for any other reason means the browser cut us off mid-dictation and
  // we resume, so a pause never silently ends the recording.
  const userStoppedRef = useRef(false)

  // Feature-detect once — the HONEST GATE. `undefined` means neither
  // constructor exists in this browser, so the caller renders nothing.
  const Ctor = typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : undefined
  // SECURE-CONTEXT GATE: the constructor can exist over plain http, but the
  // browser silently refuses to run recognition there — surface this
  // separately so the caller renders a disabled mic instead of a dead one.
  const insecureContext = typeof window !== 'undefined' && window.isSecureContext === false

  // Never leave the mic hot: stop any live session on unmount (panel/popup closed).
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // Stop the current session (user click or the effect cleanup) — idempotent.
  // Sets the user-stopped flag FIRST so the onend handler below knows this was
  // deliberate and must not auto-restart.
  const stopListening = () => {
    userStoppedRef.current = true
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  // Start a HOLD-OPEN session (Danny 08-08: "dictee stopt te snel, ik moet aan
  // en uit zelf bepalen"): `continuous: true` keeps the recognizer listening
  // across pauses instead of ending after one utterance, and the onend handler
  // restarts it if the browser still cuts off on a long silence — so the mic
  // runs until the user clicks it off (or leaves the panel), never before.
  const startListening = () => {
    // Defense in depth: the render layer already disables the button in an
    // insecure context, but never start a session that would silently hang.
    if (!Ctor || insecureContext) return
    setDenied(false)
    // Fresh session, fresh dedup state — no stale suffix from a prior utterance.
    lastEmittedRef.current = { index: -1, text: '' }
    userStoppedRef.current = false
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    // Caller-supplied language wins (e.g. the note editor's picker); else the
    // app's active UI locale — the chat composer's original behaviour.
    recognition.lang = RECOGNITION_LANG[lang ?? i18n.language] ?? 'en-US'

    // FINAL-ONLY (Danny 08-08, live: "opname wordt niet voluit geschreven?" —
    // the note read "te / st / te / st" instead of "test test"). Interim results
    // are the recognizer THINKING OUT LOUD: it emits a guess ("te"), then revises
    // it ("test"), then finalises. Emitting every interim made each guess-fragment
    // its own appended paragraph, so half-words piled up and words were split.
    // Only FINAL segments are real text, so only those are emitted — the suffix-
    // diffing this used to do cannot fix fragmentation, because a revision can
    // REPLACE earlier characters ("te" → "test" is fine, but "tekst" → "test" is
    // not a suffix at all). Interim text is still requested (interimResults=true)
    // because it makes the recognizer settle faster; it simply never leaves here.
    recognition.onresult = (event) => {
      let chunk = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) chunk += event.results[i][0].transcript
      }
      const text = chunk.trim()
      if (!text) return
      // Guard against a recognizer replaying an already-final segment.
      if (event.resultIndex === lastEmittedRef.current.index && text === lastEmittedRef.current.text) return
      lastEmittedRef.current = { index: event.resultIndex, text }
      onText(text)
    }
    // A denied mic gets an honest title instead of a silently-dead button, PLUS
    // a toast per error code so a failure is never silent (Danny 08-08: onerror
    // must be VISIBLE). no-speech/aborted stay quiet — expected silence-timeout /
    // deliberate-stop, nothing useful to tell the user.
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setDenied(true)
        notifyError(t('voice.denied', { ns: 'koios' }))
      } else if (event.error === 'service-not-allowed') {
        setDenied(true)
        notifyError(t('voice.errorServiceNotAllowed', { ns: 'koios' }))
      } else if (event.error === 'audio-capture') {
        notifyError(t('voice.errorAudioCapture', { ns: 'koios' }))
      } else if (event.error === 'network') {
        notifyError(t('voice.errorNetwork', { ns: 'koios' }))
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        notifyError(t('voice.errorGeneric', { ns: 'koios' }))
      }
      setListening(false)
    }
    // The browser ends a session on its own after a long silence even with
    // continuous=true. Resume unless the user stopped it (or the mic was
    // denied) — restarting on the SAME instance is what keeps one long
    // dictation feeling like one recording.
    recognition.onend = () => {
      if (userStoppedRef.current || recognitionRef.current !== recognition) { setListening(false); return }
      try { recognition.start() } catch { setListening(false) }
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const toggle = () => { if (listening) stopListening(); else startListening() }

  return { supported: Boolean(Ctor), insecureContext, listening, denied, toggle }
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

// `tone` intentionally dropped from the destructure: the mic is a trio chip in
// every host now (Danny 20-08); the prop stays in the interface for API compat.
export default function KoiosVoiceButton({ onText, t, lang }: KoiosVoiceButtonProps) {
  const { supported, insecureContext, listening, denied, toggle } = useSpeechDictation({ onText, lang })

  // Rules of hooks: every hook runs inside useSpeechDictation unconditionally;
  // only the render output is gated on browser support.
  if (!supported) return null

  // Insecure context (plain http): the constructor exists but recognition never
  // starts — render an honestly-disabled mic instead of a live-looking dead
  // button (§3 no fake affordances), with a tooltip explaining WHY.
  if (insecureContext) {
    const insecureTitle = t('voice.insecureContext', { ns: 'koios' })
    // Deliberately bare chrome: an inert explainer glyph in sidebar chrome, not an
    // action button — Button's grey disabled recipe would make it LOUDER than the
    // live mic beside it. Block form: the style attribute spans lines.
    /* eslint-disable huisstijlLegacy/no-restricted-syntax */
    return (
      <button type="button" disabled title={insecureTitle} aria-label={insecureTitle} style={{
        background: 'none', border: 'none', cursor: 'not-allowed', padding: '4px 5px', borderRadius: 7,
        color: 'var(--sidebar-muted)', opacity: 0.5, display: 'flex',
      }}>
        <Mic size={14} />
      </button>
    )
    /* eslint-enable huisstijlLegacy/no-restricted-syntax */
  }

  const title = denied ? t('voice.denied', { ns: 'koios' })
    : listening ? t('voice.stop', { ns: 'koios' }) : t('voice.start', { ns: 'koios' })
  // HUISSTIJL-1: idle colour per tone now reads the on-accent-safe text token
  // (never the raw brand primary, which can fail contrast on a light tenant fill).
  const idleColor = 'var(--button-ink)'

  // The mic is an aria-pressed TOGGLE with a listening state tint + pulse — a
  // different species than Button (which models actions, not pressed state).
  // Block form: the flagged style attribute sits lines into the opening tag.
  /* eslint-disable huisstijlLegacy/no-restricted-syntax */
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
          // Danny 20-08 ("hij valt niet op — een knopje van de mic maken"): the mic
          // is a real trio chip at rest so it reads as a control; recording stays
          // a DANGER tint (his reconfirmed rule: destructive/warning keeps red).
          background: listening ? tintBg('var(--color-danger)', true) : 'var(--button-fill)',
          border: listening ? tintBorder('var(--color-danger)', true) : '1px solid var(--button-border)',
          cursor: 'pointer', width: 28, height: 28, display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', borderRadius: 6,
          // chipInk while listening: the raw danger on its own tint read ~2.9:1 dark (Opus r4).
          // eslint-disable-next-line huisstijl/no-restricted-syntax -- idleColor is the untinted idle state's derived ink; provenance is opaque to the tint-ink selector
          color: listening ? chipInk('var(--color-danger)') : idleColor,
          fontWeight: listening ? 600 : 400,
          transition: 'background var(--motion-fast), color var(--motion-fast)',
        }}
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
