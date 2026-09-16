/**
 * useCustomerActivity — the customer (or sub-entity, via `endpoint`) audit-trail
 * fetch (§11 LANE-B: extracted out of ChangelogTab.tsx so the tab stays a thin
 * wrapper, mirroring the other six entities' own useXActivity hooks). `endpoint`
 * wins when given (a sub-entity's own activity route, e.g. a location/department/
 * contact detail); otherwise falls back to the customer's own route. A failed
 * request degrades to an empty list AND sets `error`, so a genuine fetch failure
 * never reads the same as "nothing happened yet" (§3 four UI states).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import { isAbortError } from '@/lib/abortError'
import type { Id } from '@/types/common'
import type { ChangelogEvent } from '@/components/drawer/tabs/EntityChangelogTab'

export function useCustomerActivity({ customerId, endpoint }: { customerId?: Id; endpoint?: string }): { items: ChangelogEvent[]; loading: boolean; error: boolean } {
  const [items, setItems] = useState<ChangelogEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const url = endpoint ?? (customerId ? `/customers/${customerId}/activity` : undefined)

  // Fetch once per mount — the shared ChangelogPopover shell only mounts this
  // content while its panel is open. Aborted on unmount/url change so a stale
  // response from a previous endpoint can never overwrite the current one.
  useEffect(() => {
    if (!url) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(false)
    api.get(url, { signal: ctrl.signal })
      .then(r => setItems((unwrapList(r).rows) as ChangelogEvent[]))
      // A real failure (not an abort) sets error and clears the list — never a
      // silent "nothing happened" for a fetch that actually failed.
      .catch(e => { if (!isAbortError(e)) { setError(true); setItems([]) } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [url])

  return { items, loading, error }
}
