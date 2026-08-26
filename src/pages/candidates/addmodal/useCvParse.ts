/**
 * useCvParse — drives the ASYNCHRONOUS CV parse behind the create-candidate modal.
 *
 * Measured contract (routes/api/tenant/candidates.php:56-57, both permission:candidates.update):
 *   POST /candidates/parse-cv        multipart, field `file`, pdf only, max 10 MB,
 *                                    throttle 10/min → 202 { status:'processing', token }
 *   GET  /candidates/parse-cv/{token} → { status:'processing' }
 *                                     | { status:'ready',  fields:{…} }
 *                                     | { status:'failed', reason:'…' }
 *                                     | 404 when the token is unknown/expired/not yours
 *
 * The hook only fetches. It never saves, and it NEVER logs the file or the parsed
 * payload — both are special-category personal data (§8); a console line here would
 * end up in a browser extension, a screenshare or a support session.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import api, { unwrap } from '@/lib/api'
import type { ParsedCvFields } from './cvPrefill'

// Poll cadence + ceiling. The parse is a Claude call over a whole PDF: normally
// 10–40s, so 2s polling is responsive without hammering, and 90s is the point where
// we stop lying to the recruiter and say it did not come back in time.
export const CV_POLL_INTERVAL_MS = 2000
export const CV_POLL_TIMEOUT_MS = 90000
// Mirrors ParseCvRequest's `mimes:pdf` + `max:10240` (KB). Client-side is UX only —
// the server re-validates, and CvParsingService even re-checks the PDF magic bytes (§7).
export const CV_MAX_BYTES = 10 * 1024 * 1024
export const CV_ACCEPT_MIME = 'application/pdf'
// PASTE-CV-1 (13-08): same endpoint, `raw_text` body instead of a file — bounds
// mirror ParseCvRequest's `raw_text` rule (30..50000 chars, XOR with file).
export const CV_TEXT_MIN_CHARS = 30
export const CV_TEXT_MAX_CHARS = 50000

/** Every message this hook can produce, as literal i18n keys (greppable, one place). */
export const CV_ERROR_KEYS = {
  notPdf: 'modal.cv.error.notPdf',
  tooLarge: 'modal.cv.error.tooLarge',
  throttled: 'modal.cv.error.throttled',
  forbidden: 'modal.cv.error.forbidden',
  expired: 'modal.cv.error.expired',
  budget: 'modal.cv.error.budget',
  unreadable: 'modal.cv.error.unreadable',
  unavailable: 'modal.cv.error.unavailable',
  timeout: 'modal.cv.error.timeout',
  generic: 'modal.cv.error.generic',
} as const

export type CvPhase = 'idle' | 'uploading' | 'processing' | 'ready' | 'error'

// Backend failure reasons (ParseCandidateCvJob + CvParsingService) → our messages.
const REASON_KEYS: Record<string, string> = {
  not_a_pdf: CV_ERROR_KEYS.notPdf,
  too_large: CV_ERROR_KEYS.tooLarge,
  unparseable: CV_ERROR_KEYS.unreadable,
  unavailable: CV_ERROR_KEYS.unavailable,
  expired: CV_ERROR_KEYS.expired,
  budget_exceeded: CV_ERROR_KEYS.budget,
}

// HTTP status → our messages. 404 is the generic "unknown or expired token" the
// controller returns for someone else's token too, so it must stay non-specific.
const STATUS_KEYS: Record<number, string> = {
  403: CV_ERROR_KEYS.forbidden,
  404: CV_ERROR_KEYS.expired,
  413: CV_ERROR_KEYS.tooLarge,
  422: CV_ERROR_KEYS.notPdf,
  429: CV_ERROR_KEYS.throttled,
}

interface PollBody {
  status?: string
  reason?: string
  fields?: ParsedCvFields
}

interface UseCvParseOptions {
  /** Called once with the parsed proposal. The caller decides what to do with it. */
  onReady: (fields: ParsedCvFields) => void
}

// Drives the async CV-parse flow: upload then poll a token until ready/failed/timeout, never persisting or logging the file or the parsed payload (see file header).
export function useCvParse({ onReady }: UseCvParseOptions) {
  const [phase, setPhase] = useState<CvPhase>('idle')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // Alive guard + in-flight request + pending poll timer, so unmount kills all three.
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The callback is stored in a ref so a re-render of the modal can never leave the
  // running poll holding a stale closure over the form state it prefills into.
  const onReadyRef = useRef(onReady)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])

  // Re-arm in SETUP, not only in cleanup: StrictMode runs setup→cleanup→setup in dev,
  // so a cleanup-only ref stays false after the second mount and silently kills every
  // poll forever (the exact bug that made PDOK need a CMD+R, §9).
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Stop everything and show one honest message. Never surfaces a raw server string.
  const fail = useCallback((key: string) => {
    if (!aliveRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('error')
    setErrorKey(key)
  }, [])

  // Map a thrown request error onto a message; a deliberate abort is not an error.
  const failFromError = useCallback((err: unknown) => {
    if (axios.isCancel(err) || (err as { code?: string })?.code === 'ERR_CANCELED') return
    const status = (err as { response?: { status?: number } })?.response?.status
    fail((status && STATUS_KEYS[status]) || CV_ERROR_KEYS.generic)
  }, [fail])

  // Poll one token until it resolves or the deadline passes. setTimeout-chained (not
  // setInterval) so a slow response can never stack overlapping requests.
  const poll = useCallback((token: string, deadline: number) => {
    // One poll attempt: reads the token's current status and either stops (ready/failed) or reschedules itself, giving up once the deadline passes.
    const tick = async () => {
      if (!aliveRef.current) return
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const body = unwrap<PollBody>(await api.get(`/candidates/parse-cv/${token}`, { signal: controller.signal }))
        if (!aliveRef.current) return

        if (body?.status === 'ready') {
          setPhase('ready')
          // Hand over the proposal; the caller merges it into the form (never saved here).
          onReadyRef.current(body.fields ?? {})
          return
        }
        if (body?.status === 'failed') {
          fail(REASON_KEYS[String(body.reason)] ?? CV_ERROR_KEYS.generic)
          return
        }
        // Still processing: stop at the ceiling rather than spin forever.
        if (Date.now() >= deadline) { fail(CV_ERROR_KEYS.timeout); return }
        timerRef.current = setTimeout(tick, CV_POLL_INTERVAL_MS)
      } catch (err) {
        failFromError(err)
      }
    }
    void tick()
  }, [fail, failFromError])

  // Upload a CV and start polling its token. Rejected files never leave the browser.
  const start = useCallback(async (file: File) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()
    setErrorKey(null)
    setFileName(file.name)

    // Pre-flight the two rules the FormRequest enforces, so an obvious mistake costs
    // no upload and no throttle slot. The server stays the authority.
    const isPdf = file.type === CV_ACCEPT_MIME || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) { fail(CV_ERROR_KEYS.notPdf); return }
    if (file.size > CV_MAX_BYTES) { fail(CV_ERROR_KEYS.tooLarge); return }

    setPhase('uploading')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const form = new FormData()
      form.append('file', file)
      const body = unwrap<{ token?: string }>(await api.post('/candidates/parse-cv', form, { signal: controller.signal }))
      if (!aliveRef.current) return
      const token = body?.token
      if (!token) { fail(CV_ERROR_KEYS.generic); return }
      setPhase('processing')
      poll(token, Date.now() + CV_POLL_TIMEOUT_MS)
    } catch (err) {
      failFromError(err)
    }
  }, [fail, failFromError, poll])

  // Paste-CV path (PASTE-CV-1): same route/token/poll, `raw_text` JSON body instead
  // of a multipart file. Under-length text never fires a request — the caller shows
  // a calm hint instead (kalme hint, geen request) rather than a round-trip error.
  const startText = useCallback(async (text: string) => {
    const value = text.trim()
    if (value.length < CV_TEXT_MIN_CHARS || value.length > CV_TEXT_MAX_CHARS) return

    if (timerRef.current) clearTimeout(timerRef.current)
    abortRef.current?.abort()
    setErrorKey(null)
    setFileName(null)

    setPhase('uploading')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const body = unwrap<{ token?: string }>(await api.post('/candidates/parse-cv', { raw_text: value }, { signal: controller.signal }))
      if (!aliveRef.current) return
      const token = body?.token
      if (!token) { fail(CV_ERROR_KEYS.generic); return }
      setPhase('processing')
      poll(token, Date.now() + CV_POLL_TIMEOUT_MS)
    } catch (err) {
      failFromError(err)
    }
  }, [fail, failFromError, poll])

  // Back to idle: abort whatever is in flight and clear the widget. Deliberately does
  // NOT clear the form — values already prefilled belong to the recruiter now.
  const reset = useCallback(() => {
    abortRef.current?.abort()
    if (timerRef.current) clearTimeout(timerRef.current)
    setPhase('idle')
    setErrorKey(null)
    setFileName(null)
  }, [])

  return { phase, errorKey, fileName, start, startText, reset }
}
