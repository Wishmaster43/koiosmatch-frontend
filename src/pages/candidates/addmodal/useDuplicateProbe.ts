/**
 * useDuplicateProbe — the live "warn while you type" duplicate check.
 *
 * DUPPOST (CONTRACT-CHANGELOG 2026-08-13, batch 13): the backend shipped a POST
 * variant of the probe — `POST /candidates/check-duplicate` with email/mobile/phone
 * in the BODY, same shape as the old GET. The GET took those fields as QUERY
 * PARAMETERS, so probing on every edit would have written a candidate's contact
 * details into web-server access logs, proxies and browser history — §7 forbids
 * PII in a query string. That is exactly why the GET variant is never called again
 * here; AddCandidateModal.test.tsx's regression test still asserts nobody calls
 * `getMock` with a `check-duplicate` URL, and it must keep passing.
 *
 * The probe is debounced and cancels its own in-flight request on the next edit
 * (§9): only the server is the duplicate authority — this is advisory, the create
 * 409 (useRestoreDuplicate's sibling flow) stays the real gate.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Id } from '@/types/common'
// The duplicate shape lives with the shared DuplicateNotice panel (SHARED-DUP-1);
// re-exported here so candidate-internal importers keep their existing path.
import type { DuplicateMatch } from '@/components/forms/DuplicateNotice'
export type { DuplicateMatch }

// Wait this long after the last keystroke before probing — long enough that a
// normal typing burst never fires more than one request.
const PROBE_DEBOUNCE_MS = 500

// Debounced live probe: email/mobile/phone in, a possible match out. Every field
// change (any of the three) clears the previous verdict — an edit means the last
// answer no longer applies to what's on screen.
export function useDuplicateProbe(email: string, mobile: string, phone: string) {
  const [match, setMatch] = useState<DuplicateMatch | null>(null)
  // Cancel the in-flight request when the inputs change again before it resolves.
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Nothing typed yet in any of the three probe fields — nothing to ask.
    abortRef.current?.abort()
    setMatch(null)
    if (!email.trim() && !mobile.trim() && !phone.trim()) return undefined

    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => {
      // POST body only — never a query string (§7, see the header note above).
      api.post('/candidates/check-duplicate', {
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
        phone: phone.trim() || undefined,
      }, { signal: controller.signal })
        .then(res => {
          const data = res.data as { exists?: boolean; match?: DuplicateMatch | null }
          setMatch(data?.exists ? (data.match ?? null) : null)
        })
        // Cancelled or failed probes stay silent — advisory only, never blocks typing.
        .catch(() => {})
    }, PROBE_DEBOUNCE_MS)

    return () => { clearTimeout(timer); controller.abort() }
  }, [email, mobile, phone])

  return { probeMatch: match, clearProbeMatch: () => setMatch(null) }
}

// Restore an archived duplicate via the per-id route (§10: een record = de
// per-id-route). The list/stats caches have no row for it yet, so invalidate them;
// the caller opens the record afterwards.
export function useRestoreDuplicate() {
  const { t } = useTranslation('candidates')
  const [restoring, setRestoring] = useState(false)

  const restore = async (id: Id): Promise<boolean> => {
    setRestoring(true)
    try {
      await api.post(`/candidates/${id}/restore`)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
      notifySuccess(t('duplicate.restored'))
      return true
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? t('duplicate.restoreForbidden') : t('duplicate.restoreFailed'))
      return false
    } finally {
      setRestoring(false)
    }
  }

  return { restore, restoring }
}
