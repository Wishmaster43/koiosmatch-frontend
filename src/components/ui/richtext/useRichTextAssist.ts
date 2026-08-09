/**
 * useRichTextAssist — the state machine behind RichTextAssistBar AND (since
 * CMFE-KOIOS-CONSISTENCY-1, Danny 09-08) the note composer's assist section:
 * idle → loading → success/error, one mode at a time, and the result stays a
 * REVIEW-ONLY suggestion until the caller explicitly applies it. This is the
 * ONE implementation (§11) — notes/useNoteAssist.ts re-exports this hook
 * rather than keeping a second copy; both surfaces hit the exact same
 * endpoint with the exact same three-mode contract.
 *
 * KOIOS-GENERATE-1 (Danny 09-08): `runGenerate` adds a FOURTH action sharing this
 * same status/result/apply/discard state — it hits the differently-shaped POST
 * /ai/koios/generate (entity+id, not text+mode) but lands in the exact same
 * review-then-Overnemen preview, so the caller never needs a second UI branch.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorKey, extractApiError } from '@/lib/extractApiError'
import { assistRichText, generateEntityText } from './richTextAssistApi'
import type { GenerateEntity, RichTextAssistMode, RichTextAssistResult } from './richTextAssistApi'

export type RichTextAssistTone = 'warning' | 'danger'
export type RichTextAssistStatus = 'idle' | 'loading' | 'success' | 'error'
// The bar tracks which control is active/loading — the three text modes plus
// 'generate', which runs a differently-shaped call (see the file header).
export type RichTextAssistActiveMode = RichTextAssistMode | 'generate'

// Expected/handled outcomes (budget exhausted, unusable answer, no API key
// configured) read as a calm notice; anything else — network, 500, or a 403
// from the module/permission gate, none of which are duplicated client-side —
// is a real failure and stays danger.
const CALM_STATUSES = [402, 422, 503]

// One failure → { message, tone } for both run() and runGenerate(): a KNOWN
// backend error CODE (koios_credit_exhausted/koios_unavailable, §10 — matched
// on the stable code, never the message text) always wins and always reads
// calm; otherwise fall back to the HTTP-status heuristic with the server's own
// message. Shared so a coded error translates identically everywhere this hook
// is used (the bar, notes, generate) instead of drifting per call site.
function describeFailure(err: unknown, t: (key: string) => string, fallback: string): { message: string; tone: RichTextAssistTone } {
  const key = apiErrorKey(err)
  if (key) return { message: t(key), tone: 'warning' }
  const httpStatus = (err as { response?: { status?: number } })?.response?.status
  return { message: extractApiError(err, fallback), tone: CALM_STATUSES.includes(httpStatus ?? 0) ? 'warning' : 'danger' }
}

export function useRichTextAssist(language?: string) {
  const { t } = useTranslation('common')
  const [mode, setMode] = useState<RichTextAssistActiveMode | null>(null)
  const [status, setStatus] = useState<RichTextAssistStatus>('idle')
  const [result, setResult] = useState<RichTextAssistResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [tone, setTone] = useState<RichTextAssistTone>('danger')

  // Alive guard (§9): a click can outlive the field (drawer closed, edit mode
  // cancelled) — never set state after unmount. Re-armed in SETUP, not only in
  // cleanup: StrictMode runs setup→cleanup→setup in dev, so a cleanup-only ref
  // would stay false forever and silently kill every later request.
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; abortRef.current?.abort() }
  }, [])

  // Run one mode over the given html. Empty text is a silent no-op, mirroring
  // the button's own disabled state, so this never fires a guaranteed-422 call.
  // One request at a time — the buttons disable while loading, but the abort
  // still guards a rapid double-invoke.
  const run = useCallback((m: RichTextAssistMode, html: string) => {
    if (!html.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setMode(m); setStatus('loading'); setResult(null); setErrorMessage('')
    assistRichText({ text: html, language, mode: m }, controller.signal)
      .then(res => { if (aliveRef.current) { setResult(res); setStatus('success') } })
      .catch(err => {
        if (!aliveRef.current || err?.code === 'ERR_CANCELED') return
        const { message, tone: failTone } = describeFailure(err, t, t('notesAssist.error'))
        setTone(failTone); setErrorMessage(message); setStatus('error')
      })
  }, [language, t])

  // Generate a fresh suggestion FROM the entity's own data (KOIOS-GENERATE-1) —
  // no text/empty-field guard (unlike run() above): a blank profile is exactly
  // the case this is for. Same abort-and-replace + review-only landing as run().
  const runGenerate = useCallback((entity: GenerateEntity, id: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setMode('generate'); setStatus('loading'); setResult(null); setErrorMessage('')
    generateEntityText({ entity, id }, controller.signal)
      .then(res => { if (aliveRef.current) { setResult(res); setStatus('success') } })
      .catch(err => {
        if (!aliveRef.current || err?.code === 'ERR_CANCELED') return
        const { message, tone: failTone } = describeFailure(err, t, t('notesAssist.error'))
        setTone(failTone); setErrorMessage(message); setStatus('error')
      })
  }, [t])

  // Discard the suggestion (or a stale error) — the panel stays open so another
  // mode can be tried right away; the user's own draft is left untouched.
  const discard = useCallback(() => { setMode(null); setStatus('idle'); setResult(null); setErrorMessage('') }, [])

  return { mode, status, result, errorMessage, tone, run, runGenerate, discard }
}
