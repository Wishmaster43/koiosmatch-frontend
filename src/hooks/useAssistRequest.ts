/**
 * useAssistRequest — generic state machine for AI assist affordances
 * (useConversationAssist + useRichTextAssist, DRY-8 unit 3): idle → loading →
 * success/error, one mode at a time, alive guard, and abort handling. Both
 * consumers keep their own file-top doc (KOIOS-GENERATE-1, the conversation's
 * "no text is sent from the client" note, …) since that provenance is specific
 * to the caller, not to this shared mechanic.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorKey, extractApiError } from '@/lib/extractApiError'

export type AssistStatus = 'idle' | 'loading' | 'success' | 'error'
export type AssistTone = 'warning' | 'danger'

// Expected/handled outcomes (budget exhausted, unusable answer, no API key/AI
// temporarily unconfigured) read as a calm notice; anything else — network,
// 500, or a 403 from the module/permission gate, none of which are duplicated
// client-side — is a real failure and stays danger.
const CALM_STATUSES = [402, 422, 503]

// One failure → { message, tone } for every assist consumer (the rich-text bar,
// notes, generate, and the conversation composer): a KNOWN backend error CODE
// (koios_credit_exhausted/koios_unavailable, §10 — matched on the stable code,
// never the message text) always wins and always reads calm; otherwise fall
// back to the HTTP-status heuristic with the server's own message. Shared so a
// coded error translates identically everywhere this hook is used instead of
// drifting per call site. Not exported: only `fail` below calls it.
function describeAssistFailure(err: unknown, t: (key: string) => string, fallback: string): { message: string; tone: AssistTone } {
  const key = apiErrorKey(err)
  if (key) return { message: t(key), tone: 'warning' }
  const httpStatus = (err as { response?: { status?: number } })?.response?.status
  return { message: extractApiError(err, fallback), tone: CALM_STATUSES.includes(httpStatus ?? 0) ? 'warning' : 'danger' }
}

export interface UseAssistStateOptions {
  t: (key: string) => string
  fallback: string
}

// Shared state machine for assist hooks: manages status/result/error, alive guard, and abort.
export function useAssistState<T, M = unknown>({ t, fallback }: UseAssistStateOptions) {
  const [mode, setMode] = useState<M | null>(null)
  const [status, setStatus] = useState<AssistStatus>('idle')
  const [result, setResult] = useState<T | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [tone, setTone] = useState<AssistTone>('danger')

  // Alive guard (§9): a click can outlive the surface that started it (drawer
  // closed, edit mode cancelled, thread collapsed) — never set state after
  // unmount. Re-armed in SETUP, not only in cleanup: StrictMode runs
  // setup→cleanup→setup in dev, so a cleanup-only ref would stay false forever
  // and silently kill every later request.
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  // Marks the hook alive on mount and dead on unmount, aborting any in-flight request; re-armed in setup (not only cleanup) so StrictMode double-mount never leaves it permanently false.
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false; abortRef.current?.abort() }
  }, [])

  // Begin loading with a mode; abort any in-flight request. One request at a
  // time — the caller's buttons disable while loading, but the abort still
  // guards a rapid double-invoke.
  const startLoading = useCallback((m: M) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setMode(m)
    setStatus('loading')
    setResult(null)
    setErrorMessage('')
    return controller.signal
  }, [])

  // Handle success: set result and status. The result stays a review-only
  // suggestion until the caller explicitly applies it.
  const succeed = useCallback((res: T) => {
    if (aliveRef.current) {
      setResult(res)
      setStatus('success')
    }
  }, [])

  // Handle error: parse and set message + tone; a cancelled request or an
  // unmounted caller is silently ignored, never surfaced as an error.
  const fail = useCallback((err: unknown) => {
    if (!aliveRef.current || (err as { code?: string } | null)?.code === 'ERR_CANCELED') return
    const { message, tone: failTone } = describeAssistFailure(err, t, fallback)
    setTone(failTone)
    // The key ships in all seven locale bundles, so it carries no defaultValue
    // of its own (§5: one source per label — never a second, drifting truth).
    setErrorMessage(message)
    setStatus('error')
  }, [t, fallback])

  // Discard the suggestion (or a stale error) — the caller stays mounted so
  // another mode can be tried right away; the caller's own draft/text is left
  // EXACTLY as it was (discard never touches it), only the assist state resets.
  const discard = useCallback(() => {
    setMode(null)
    setStatus('idle')
    setResult(null)
    setErrorMessage('')
  }, [])

  return { mode, status, result, errorMessage, tone, startLoading, succeed, fail, discard }
}
