/**
 * useFailedJobs — the failure log (Taakbeheer → Mislukt tab): filters/pagination
 * plus the four intervention actions a super admin needs (retry one, retry all,
 * forget one, flush all). The two "all" actions are destructive/irreversible —
 * the confirm prompt lives in the tab component; this hook only executes once
 * confirmed and surfaces the server's error message on failure.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFailedJobs, retryFailedJob, forgetFailedJob, retryAllFailedJobs, flushFailedJobs } from './jobsApi'
import { unwrapList } from '@/lib/api'

const POLL_MS = 15000

export function useFailedJobs() {
  const { t } = useTranslation('settings')
  const [filters, setFilters] = useState({ queue: '', tenant: '' })
  // BE caps this list at the newest 5.000 rows and says so (audit 15-07) — the
  // tab shows a banner when the flag is set.
  const [truncated, setTruncated] = useState(false)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ rows: [], total: 0, page: 1, lastPage: 1 })
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const [busyId, setBusyId] = useState(null) // uuid of the row being retried/forgotten
  const [bulkBusy, setBulkBusy] = useState(false) // retry-all / flush in flight
  const [actionError, setActionError] = useState(null)
  const abortRef = useRef(null)

  const params = useMemo(() => {
    const p = { page, per_page: 25 }
    if (filters.queue) p.queue = filters.queue
    if (filters.tenant) p.tenant = filters.tenant
    return p
  }, [filters, page])

  const load = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetchFailedJobs(params, ctrl.signal)
      .then((data) => { setResult(unwrapList(data)); setTruncated(Boolean(data?.data?.truncated)); setPhase('ready') })
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') setPhase('error') })
  }, [params])

  useEffect(() => {
    setPhase('loading')
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => { clearInterval(id); abortRef.current?.abort() }
  }, [load])

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1) }

  // Re-queue one failed job.
  const retry = async (uuid) => {
    setActionError(null); setBusyId(uuid)
    try { await retryFailedJob(uuid); load() }
    catch (err) { setActionError(err?.response?.data?.message ?? t('jobs.actionFailed')) }
    finally { setBusyId(null) }
  }

  // Drop one failed job permanently.
  const forget = async (uuid) => {
    setActionError(null); setBusyId(uuid)
    try { await forgetFailedJob(uuid); load() }
    catch (err) { setActionError(err?.response?.data?.message ?? t('jobs.actionFailed')) }
    finally { setBusyId(null) }
  }

  // Re-queue every failed job (irreversible — caller confirms before calling this).
  const retryAll = async () => {
    setActionError(null); setBulkBusy(true)
    try { await retryAllFailedJobs(); load() }
    catch (err) { setActionError(err?.response?.data?.message ?? t('jobs.actionFailed')) }
    finally { setBulkBusy(false) }
  }

  // Wipe every failed job (irreversible — caller confirms before calling this).
  const flush = async () => {
    setActionError(null); setBulkBusy(true)
    try { await flushFailedJobs(); load() }
    catch (err) { setActionError(err?.response?.data?.message ?? null) }
    finally { setBulkBusy(false) }
  }

  return {
    filters, setFilter, page, setPage, result, phase, refetch: load,
    retry, forget, retryAll, flush, busyId, bulkBusy, actionError, setActionError,
    truncated,
  }
}
