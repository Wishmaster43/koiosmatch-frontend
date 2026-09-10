/**
 * useFailedJobs — the failure log (Taakbeheer → Mislukt tab): filters/pagination
 * plus the four intervention actions (retry/forget one, retry-all/flush all).
 * Uses shared useJobsQuery for the pagination/filtering/polling infrastructure.
 * Confirmation for destructive bulk actions lives in the tab component.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchFailedJobs, retryFailedJob, forgetFailedJob, retryAllFailedJobs, flushFailedJobs } from './jobsApi'
import { extractApiError } from '@/lib/extractApiError'
import { useJobsQuery } from './useJobsQuery'

// Owns the failed-jobs list (filters, paging, polling) plus intervention actions.
export function useFailedJobs() {
  const { t } = useTranslation('settings')
  const [truncated, setTruncated] = useState(false) // BE caps at 5000 rows
  const [busyId, setBusyId] = useState(null) // uuid being retried/forgotten
  const [bulkBusy, setBulkBusy] = useState(false) // retry-all / flush in flight
  const [actionError, setActionError] = useState(null)

  // Use shared query infrastructure; extract truncated from response.
  const query = useJobsQuery({
    fetchFn: fetchFailedJobs,
    buildParams: (filters, page) => {
      const p = { page, per_page: 25 }
      if (filters.queue) p.queue = filters.queue
      if (filters.tenant) p.tenant = filters.tenant
      return p
    },
    initialFilters: { queue: '', tenant: '' },
    onResult: (data) => setTruncated(Boolean(data?.data?.truncated)),
  })

  // Re-queue one failed job.
  const retry = async (uuid) => {
    setActionError(null)
    setBusyId(uuid)
    try {
      await retryFailedJob(uuid)
      query.refetch()
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
      query.refetch()
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
      const res = await retryAllFailedJobs(query.filters.queue || undefined, query.filters.tenant || undefined)
      const { count = 0, skipped = [], truncated: wasTruncated = false, scope } = res.data ?? {}
      query.refetch()
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
      const res = await flushFailedJobs(query.filters.queue || undefined, query.filters.tenant || undefined)
      query.refetch()
      return res.data
    } catch (err) {
      setActionError(extractApiError(err, t('jobs.actionFailed')))
      return null
    } finally {
      setBulkBusy(false)
    }
  }

  return {
    filters: query.filters,
    setFilter: query.setFilter,
    page: query.page,
    setPage: query.setPage,
    result: query.result,
    phase: query.phase,
    refetch: query.refetch,
    retry,
    forget,
    retryAll,
    flush,
    busyId,
    bulkBusy,
    actionError,
    setActionError,
    truncated,
  }
}
