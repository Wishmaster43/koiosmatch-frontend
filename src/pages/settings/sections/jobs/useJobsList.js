/**
 * useJobsList — the individual pending/reserved jobs list (Taakbeheer → Taken tab).
 * Owns filters (queue/tenant/status) + pagination and the cancel action. Polls
 * modestly (15s, visible-tab only) since a running job's `runtime_seconds` is
 * only useful live. A 409 (job already reserved/running) surfaces the server's
 * own message instead of a generic error — that message IS the explanation.
 * Uses shared useJobsQuery for the pagination/filtering/polling infrastructure.
 */
import { useState } from 'react'
import { fetchJobsList, cancelJob } from './jobsApi'
import { useJobsQuery } from './useJobsQuery'

// Owns filters, pagination, the 15s visible-tab poll and the cancel action for the pending/reserved jobs list.
export function useJobsList() {
  const [cancelError, setCancelError] = useState(null)

  // Use shared query infrastructure for filters, pagination, and polling.
  const query = useJobsQuery({
    fetchFn: fetchJobsList,
    buildParams: (filters, page) => {
      const p = { page, per_page: 25 }
      if (filters.queue) p.queue = filters.queue
      if (filters.tenant) p.tenant = filters.tenant
      if (filters.status) p.status = filters.status
      return p
    },
    initialFilters: { queue: '', tenant: '', status: '' },
  })

  // Cancel a pending job; a 409 (already reserved/running) shows the backend's own explanation.
  const cancel = async (id) => {
    setCancelError(null)
    try {
      await cancelJob(id)
      query.refetch()
    } catch (err) {
      setCancelError({ id, message: err?.response?.data?.message ?? null })
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
    cancel,
    cancelError,
    setCancelError,
  }
}
