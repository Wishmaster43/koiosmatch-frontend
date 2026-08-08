/**
 * useRichTextAssist — the state machine behind RichTextAssistBar AND (since
 * CMFE-KOIOS-CONSISTENCY-1, Danny 09-08) the note composer's assist section:
 * idle → loading → success/error, one mode at a time, and the result stays a
 * REVIEW-ONLY suggestion until the caller explicitly applies it. This is the
 * ONE implementation (§11) — notes/useNoteAssist.ts re-exports this hook
 * rather than keeping a second copy; both surfaces hit the exact same
 * endpoint with the exact same three-mode contract.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractApiError } from '@/lib/extractApiError'
import { assistRichText } from './richTextAssistApi'
import type { RichTextAssistMode, RichTextAssistResult } from './richTextAssistApi'

export type RichTextAssistTone = 'warning' | 'danger'
export type RichTextAssistStatus = 'idle' | 'loading' | 'success' | 'error'

// Expected/handled outcomes (budget exhausted, unusable answer, no API key
// configured) read as a calm notice; anything else — network, 500, or a 403
// from the module/permission gate, none of which are duplicated client-side —
// is a real failure and stays danger.
const CALM_STATUSES = [402, 422, 503]

export function useRichTextAssist(language?: string) {
  const { t } = useTranslation('common')
  const [mode, setMode] = useState<RichTextAssistMode | null>(null)
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
        const httpStatus = (err as { response?: { status?: number } })?.response?.status
        setTone(CALM_STATUSES.includes(httpStatus ?? 0) ? 'warning' : 'danger')
        setErrorMessage(extractApiError(err, t('notesAssist.error')))
        setStatus('error')
      })
  }, [language, t])

  // Discard the suggestion (or a stale error) — the panel stays open so another
  // mode can be tried right away; the user's own draft is left untouched.
  const discard = useCallback(() => { setMode(null); setStatus('idle'); setResult(null); setErrorMessage('') }, [])

  return { mode, status, result, errorMessage, tone, run, discard }
}
