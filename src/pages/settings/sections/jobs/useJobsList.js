/**
 * useJobsList — the individual pending/reserved jobs list (Taakbeheer → Taken tab).
 * Owns filters (queue/tenant/status) + pagination and the cancel action. Polls
 * modestly (15s, visible-tab only) since a running job's `runtime_seconds` is
 * only useful live. A 409 (job already reserved/running) surfaces the server's
 * own message instead of a generic error — that message IS the explanation.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchJobsList, cancelJob } from './jobsApi'
import { unwrapList } from '@/lib/api'

const POLL_MS = 15000

export function useJobsList() {
  const [filters, setFilters] = useState({ queue: '', tenant: '', status: '' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ rows: [], total: 0, page: 1, lastPage: 1 })
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [cancelError, setCancelError] = useState(null)
  const abortRef = useRef(null)

  // Build the request params the backend accepts — drop empty filter values.
  const params = useMemo(() => {
    const p = { page, per_page: 25 }
    if (filters.queue) p.queue = filters.queue
    if (filters.tenant) p.tenant = filters.tenant
    if (filters.status) p.status = filters.status
    return p
  }, [filters, page])

  // Fetch the current page; cancels any in-flight request first.
  const load = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetchJobsList(params, ctrl.signal)
      .then((data) => { setResult(unwrapList(data)); setPhase('ready') })
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') setPhase('error') })
  }, [params])

  useEffect(() => {
    setPhase('loading')
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => { clearInterval(id); abortRef.current?.abort() }
  }, [load])

  // Reset to page 1 whenever a filter changes (stale page numbers otherwise 404-ish empty).
  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1) }

  // Cancel a pending job; a 409 (already reserved/running) shows the backend's own explanation.
  const cancel = async (id) => {
    setCancelError(null)
    try {
      await cancelJob(id)
      load()
    } catch (err) {
      setCancelError({ id, message: err?.response?.data?.message ?? null })
    }
  }

  return { filters, setFilter, page, setPage, result, phase, refetch: load, cancel, cancelError, setCancelError }
}
