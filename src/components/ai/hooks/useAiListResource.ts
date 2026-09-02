/**
 * useAiListResource — shared list/loading/error/reload machinery for an
 * AI-management tab (Agents/Prompts/FAQ). Extracted from AIManagementTabs so
 * the fetch-on-mount + loading/error bookkeeping is written once (§3/§9).
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import api, { unwrapList } from '@/lib/api'

// A secondary endpoint loaded alongside the primary list (e.g. AgentsTab's
// prompts/faqs option lists) — failures are swallowed to an empty list so a
// broken option source never blocks the primary resource from rendering.
export interface SecondaryResource<T> {
  endpoint: string
  onLoaded: (rows: T[]) => void
}

export interface UseAiListResourceOptions<T> {
  endpoint: string
  onLoaded: (rows: T[]) => void
  secondary?: SecondaryResource<unknown>[]
}

// Fetches `endpoint` (+ any `secondary` endpoints) on mount and on demand via
// `reload`, tracking `loading`/`loadError` the same way every AI tab needs it.
// A failed PRIMARY load sets loadError; a failed secondary load never does —
// it degrades to an empty list (mirrors the original AgentsTab .catch()).
export function useAiListResource<T>({ endpoint, onLoaded, secondary = [] }: UseAiListResourceOptions<T>) {
  const [loading, setLoading] = useState(true)
  // A failed load must render its own state, never the "nothing yet" empty state (R8).
  const [loadError, setLoadError] = useState(false)

  // The caller's callbacks/secondary list are re-created every render (inline
  // arrays and closures); keep the LATEST ones in refs so `load` only changes
  // identity with the endpoint — no refetch loop, no ignored dependency.
  const onLoadedRef = useRef(onLoaded); onLoadedRef.current = onLoaded
  const secondaryRef = useRef(secondary); secondaryRef.current = secondary

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    const secondaries = secondaryRef.current
    Promise.all([
      api.get(endpoint),
      ...secondaries.map(s => api.get(s.endpoint).catch(() => ({ data: [] }))),
    ]).then(([primary, ...rest]) => {
      onLoadedRef.current(unwrapList<T>(primary).rows)
      rest.forEach((res, i) => secondaries[i].onLoaded(unwrapList<unknown>(res).rows))
    }).catch(() => setLoadError(true)).finally(() => setLoading(false))
  }, [endpoint])

  useEffect(() => { load() }, [load])

  return { loading, loadError, reload: load }
}
