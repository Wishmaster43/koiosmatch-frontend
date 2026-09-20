import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { Id } from '@/types/common'

// Wait this long after the last keystroke before probing — long enough that a
// normal typing burst never fires more than one request.
const PROBE_DEBOUNCE_MS = 500

/**
 * useDuplicateProbe — the generic "warn while you type" duplicate check, shared
 * by candidates and customers (was two near-identical copies, DRY-1). POST body
 * only — never a query string (§7: PII/business details would land in access
 * logs, proxies and browser history). Debounced and cancels its own in-flight
 * request on the next edit; this is advisory only, the create 409 stays the
 * real gate. `keys` maps the three watched values onto the API's own body field
 * names, in order — pass a MODULE-SCOPE constant tuple so the reference stays
 * stable across renders (the effect deps then need no exemption).
 */
export function useDuplicateProbe<TMatch>(
  path: string,
  keys: readonly [string, string, string],
  a: string, b: string, c: string,
): { probeMatch: TMatch | null; clearProbeMatch: () => void } {
  const [match, setMatch] = useState<TMatch | null>(null)
  // Cancel the in-flight request when the inputs change again before it resolves.
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Nothing typed yet in any of the three probe fields — nothing to ask.
    abortRef.current?.abort()
    setMatch(null)
    if (!a.trim() && !b.trim() && !c.trim()) return undefined

    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(() => {
      api.post(path, {
        [keys[0]]: a.trim() || undefined,
        [keys[1]]: b.trim() || undefined,
        [keys[2]]: c.trim() || undefined,
      }, { signal: controller.signal })
        .then(res => {
          const data = res.data as { exists?: boolean; match?: TMatch | null }
          setMatch(data?.exists ? (data.match ?? null) : null)
        })
        // Cancelled or failed probes stay silent — advisory only, never blocks typing.
        .catch(() => {})
    }, PROBE_DEBOUNCE_MS)

    return () => { clearTimeout(timer); controller.abort() }
  }, [path, keys, a, b, c])

  return { probeMatch: match, clearProbeMatch: () => setMatch(null) }
}

interface UseRestoreArchivedDuplicateOptions {
  entity: 'candidates' | 'customers'
  // Resolved by the caller's own t() (rule C) — never resolved in this shared hook.
  messages: { restored: string; restoreForbidden: string; restoreFailed: string }
}

/**
 * useRestoreArchivedDuplicate — restore an archived duplicate via the per-id
 * route (§10: a record = the per-id route), shared by candidates and
 * customers (was two near-identical copies, DRY round 11). The list/stats
 * caches have no row for it yet, so invalidate them; the caller opens the
 * record afterwards.
 */
export function useRestoreArchivedDuplicate({ entity, messages }: UseRestoreArchivedDuplicateOptions) {
  const [restoring, setRestoring] = useState(false)

  const restore = async (id: Id): Promise<boolean> => {
    setRestoring(true)
    try {
      await api.post(`/${entity}/${id}/restore`)
      queryClient.invalidateQueries({ queryKey: [entity] })
      notifySuccess(messages.restored)
      return true
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      notifyError(status === 403 ? messages.restoreForbidden : messages.restoreFailed)
      return false
    } finally {
      setRestoring(false)
    }
  }

  return { restore, restoring }
}
