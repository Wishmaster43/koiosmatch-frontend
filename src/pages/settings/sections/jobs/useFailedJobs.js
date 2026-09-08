/**
 * useFailedJobs — the failure log (Taakbeheer → Mislukt tab): filters/pagination
 * plus the four intervention actions (retry/forget one, retry-all/flush all).
 * Extracted common patterns (pagination, filtering, polling) with useJobsList.
 * Confirmation for destructive bulk actions lives in the tab component.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFailedJobs, retryFailedJob, forgetFailedJob, retryAllFailedJobs, flushFailedJobs } from './jobsApi'
import { unwrapList } from '@/lib/api'
import { extractApiError } from '@/lib/extractApiError'

const POLL_MS = 15000

// Owns the failed-jobs list (filters, paging, polling) plus intervention actions.
export function useFailedJobs() {
  const { t } = useTranslation('settings')
  const [filters, setFilters] = useState({ queue: '', tenant: '' })
  const [truncated, setTruncated] = useState(false) // BE caps at 5000 rows
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ rows: [], total: 0, page: 1, lastPage: 1 })
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [busyId, setBusyId] = useState(null) // uuid being retried/forgotten
  const [bulkBusy, setBulkBusy] = useState(false) // retry-all / flush in flight
  const [actionError, setActionError] = useState(null)
  const abortRef = useRef(null)

  // Query params derived from the current filters/page; omits empty filter values.
  const params = useMemo(() => {
    const p = { page, per_page: 25 }
    if (filters.queue) p.queue = filters.queue
    if (filters.tenant) p.tenant = filters.tenant
    return p
  }, [filters, page])

  // Fetches the current page; aborts any in-flight request first.
  const load = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetchFailedJobs(params, ctrl.signal)
      .then((data) => {
        setTruncated(Boolean(data?.data?.truncated))
        setResult(unwrapList(data))
        setPhase('ready')
      })
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') setPhase('error') })
  }, [params])

  // Loads on mount/filter change and then polls every 15s while visible; cleanup aborts.
  useEffect(() => {
    setPhase('loading')
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => { clearInterval(id); abortRef.current?.abort() }
  }, [load])

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1) }

  // Re-queue one failed job.
  const retry = async (uuid) => {
    setActionError(null)
    setBusyId(uuid)
    try {
      await retryFailedJob(uuid)
      load()
    } catch (err) {
      setActionError(extractApiError(err, t('jobs.actionFailed')))
    } finally {
      setBusyId(null)
    }
  }

  // Drop one failed job permanently.
  const forget = async (uuid) => {
    setActionError(null)
    setBusyId(uuid)
    try {
      await forgetFailedJob(uuid)
      load()
    } catch (err) {
      setActionError(extractApiError(err, t('jobs.actionFailed')))
    } finally {
      setBusyId(null)
    }
  }

  // Re-queue failed jobs matching the selected queue/tenant filters (or all if no filters).
  // Resolves the server's {count, skipped, truncated, scope} so the caller can say what
  // happened and confirm the scope (B-53/I-2, X-41), or null when the request failed.
  const retryAll = async () => {
    setActionError(null)
    setBulkBusy(true)
    try {
      const res = await retryAllFailedJobs(filters.queue || undefined, filters.tenant || undefined)
      const { count = 0, skipped = [], truncated: wasTruncated = false, scope } = res.data ?? {}
      load()
      return { count, skipped, truncated: Boolean(wasTruncated), scope }
    } catch (err) {
      setActionError(extractApiError(err, t('jobs.actionFailed')))
      return null
    } finally {
      setBulkBusy(false)
    }
  }

  // Clear failed jobs matching the optional queue/tenant filters (X-41 — irreversible, caller confirms).
  const flush = async () => {
    setActionError(null)
    setBulkBusy(true)
    try {
      const res = await flushFailedJobs(filters.queue || undefined, filters.tenant || undefined)
      load()
      return res.data
    } catch (err) {
      setActionError(extractApiError(err, t('jobs.actionFailed')))
      return null
    } finally {
      setBulkBusy(false)
    }
  }

  return {
    filters, setFilter, page, setPage, result, phase, refetch: load,
    retry, forget, retryAll, flush, busyId, bulkBusy, actionError, setActionError, truncated,
  }
}
