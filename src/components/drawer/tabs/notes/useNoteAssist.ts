/**
 * useNoteAssist — state machine for the note composer's Koios AI assist section
 * (NOTE-ASSIST-1 F3). Mirrors useGenerateDescription's shape (idle → loading →
 * success/error, never auto-applies): one mode runs at a time, the result is a
 * REVIEW-ONLY suggestion until the caller explicitly applies it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractApiError } from '@/lib/extractApiError'
import { assistNote } from './noteAssistApi'
import type { AssistMode, AssistResult } from './noteAssistApi'

export type AssistTone = 'warning' | 'danger'
export type AssistStatus = 'idle' | 'loading' | 'success' | 'error'

// Expected/handled outcomes (budget exhausted, no usable actions, AI temporarily
// unconfigured) read as a calm notice; anything else (network/500) is a real
// failure — mirrors GenerateDescriptionFlow's unavailable(warning)/error(danger) split.
const CALM_STATUSES = [402, 422, 503]

export function useNoteAssist(language?: string) {
  const { t } = useTranslation('common')
  const [mode, setMode] = useState<AssistMode | null>(null)
  const [status, setStatus] = useState<AssistStatus>('idle')
  const [result, setResult] = useState<AssistResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [tone, setTone] = useState<AssistTone>('danger')

  // Alive guard (§9): a click can outlive the popup (closed mid-request) — never
  // set state after unmount. Re-armed in SETUP, not only cleanup — StrictMode
  // runs setup→cleanup→setup in dev, a cleanup-only ref would stay false forever.
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; abortRef.current?.abort() }
  }, [])

  // Run one mode over the given text. One request at a time — the buttons are
  // disabled while loading, so this never actually overlaps in practice, but the
  // abort still guards a rapid double-invoke (e.g. a fast double-click).
  const run = useCallback((m: AssistMode, text: string) => {
    if (!text.trim()) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setMode(m); setStatus('loading'); setResult(null); setErrorMessage('')
    assistNote({ text, language, mode: m }, controller.signal)
      .then(res => { if (aliveRef.current) { setResult(res); setStatus('success') } })
      .catch(err => {
        if (!aliveRef.current || err?.code === 'ERR_CANCELED') return
        const httpStatus = (err as { response?: { status?: number } })?.response?.status
        setTone(CALM_STATUSES.includes(httpStatus ?? 0) ? 'warning' : 'danger')
        // DEFAULT-VALUE-1 (Danny 07-08): Dutch defaultValue so a raw key never shows
        // while common:notesAssist.* is still pending in the shipped locale files.
        setErrorMessage(extractApiError(err, t('notesAssist.error', { defaultValue: 'Koios kon dit niet verwerken. Probeer het opnieuw.' })))
        setStatus('error')
      })
  }, [language, t])

  // Discard the suggestion (or a stale error) — the section stays mounted so the
  // recruiter can try another mode right away.
  const discard = useCallback(() => { setMode(null); setStatus('idle'); setResult(null); setErrorMessage('') }, [])

  return { mode, status, result, errorMessage, tone, run, discard }
}
