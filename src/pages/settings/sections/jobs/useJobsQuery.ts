/**
 * useJobsQuery — shared patterns for paginated, filterable jobs lists with polling.
 * Owned by useFailedJobs and useJobsList (tasks / failed jobs).
 * Builds params, loads with AbortController, polls while visible, resets page on filter change.
 * fetchFn/buildParams/onResult ride in refs (updated every render) so an inline
 * arrow function at the call site never re-triggers the load effect — only
 * filters/page actually restart the fetch.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { unwrapList } from '@/lib/api'
import { useVisiblePoll } from '@/hooks/useVisiblePoll'

const POLL_MS = 15000

interface UseJobsQueryOptions<TFilters> {
  // The async fetch function (e.g. fetchJobsList); it receives params and signal.
  fetchFn: (params: Record<string, unknown>, signal: AbortSignal) => Promise<{ data: { rows: unknown[]; total: number; page: number; last_page: number } }>
  // Builds request params from filters/page; drops empty values.
  buildParams: (filters: TFilters, page: number) => Record<string, unknown>
  // Initial filter state.
  initialFilters: TFilters
  // Process the fetch response before setting result; can extract extra data (e.g. truncated).
  onResult?: (data: { data: { rows: unknown[]; total: number; page: number; last_page: number } }) => void
}

interface UseJobsQueryResult<TFilters> {
  filters: TFilters
  setFilter: (key: keyof TFilters, value: unknown) => void
  page: number
  setPage: (p: number) => void
  result: { rows: unknown[]; total: number; page: number; lastPage: number }
  phase: 'loading' | 'ready' | 'error'
  refetch: () => void
}

// Generic hook for paginated, filtered query patterns with polling (jobs).
export function useJobsQuery<TFilters>(opts: UseJobsQueryOptions<TFilters>): UseJobsQueryResult<TFilters> {
  const { fetchFn, buildParams, initialFilters, onResult } = opts
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ rows: [], total: 0, page: 1, lastPage: 1 })
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const abortRef = useRef<AbortController | null>(null)

  // Keep the latest callbacks in refs — an inline arrow at the call site must not
  // change `load`'s identity, or the mount effect below would re-fire every render.
  const fetchFnRef = useRef(fetchFn)
  const buildParamsRef = useRef(buildParams)
  const onResultRef = useRef(onResult)
  useEffect(() => {
    fetchFnRef.current = fetchFn
    buildParamsRef.current = buildParams
    onResultRef.current = onResult
  })

  // Fetch the current page; aborts any in-flight request first. Only filters/page
  // (both real state) change this callback's identity.
  const load = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const params = buildParamsRef.current(filters, page)
    fetchFnRef.current(params, ctrl.signal)
      .then((data) => {
        onResultRef.current?.(data)
        setResult(unwrapList(data))
        setPhase('ready')
      })
      .catch((err) => {
        if (err?.code !== 'ERR_CANCELED') setPhase('error')
      })
  }, [filters, page])

  // Load on mount/filter/page change; cleanup aborts.
  useEffect(() => {
    setPhase('loading')
    load()
    return () => abortRef.current?.abort()
  }, [load])

  // Poll while visible.
  useVisiblePoll(load, POLL_MS)

  // Reset to page 1 whenever a filter changes (stale page numbers otherwise 404-ish empty).
  const setFilter = (key: keyof TFilters, value: unknown) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  return { filters, setFilter, page, setPage, result, phase, refetch: load }
}
