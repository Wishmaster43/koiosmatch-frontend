/**
 * useMatchesBulkActions — bulk operations for MatchesPage. A match is read-only
 * (§3B: the continuation of a Hired application), so the only bulk
 * operations are row/all selection and authorization-gated *coupling* to an
 * external backoffice (HelloFlex / Shiftmanager). SYNC-BULK-1: this shares the
 * ONE generic POST /sync/{entity}/bulk endpoint the per-record BackofficeLinksTab
 * already uses (the earlier /matches/bulk/couple route this file called never
 * existed on the backend — a dead action hiding behind a green unit test that
 * only proved the callback fired, never the request). The endpoint queues +
 * rate-limits the coupling and returns { queued, skipped } — because nothing on
 * the row changes there is no optimistic patch, and the toast stays honest about
 * "queued" vs a real skip (matrix block / unknown id). Toasts come from the
 * shared notifier so a bulk action never fails silently (§10).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api, { isServiceUnavailable } from '@/lib/api'
import { notify } from '@/lib/notify'
import type { Id } from '@/types/common'

export type CoupleTarget = 'helloflex' | 'shiftmanager'

interface UseMatchesBulkActionsArgs {
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  t: TFunction
}

export function useMatchesBulkActions({ selectedIds, setSelectedIds, t }: UseMatchesBulkActionsArgs) {
  // ── Bulk selection ──
  const toggleRow = (id: Id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = (ids: Id[], allSelected: boolean) => setSelectedIds(prev => {
    const next = new Set(prev)
    ids.forEach(id => { if (allSelected) next.delete(id); else next.add(id) })
    return next
  })

  // Queue the selection for backoffice coupling via the ONE generic bulk-sync
  // endpoint (BackofficeSyncController::bulk — same route the candidate/customer
  // bulk bars use). It returns { queued, skipped }, never a bare success — a
  // matrix block or an unknown/other-tenant id lands in `skipped` rather than
  // failing the whole batch, so the toast must say so instead of a blanket
  // "success". 404 (route not deployed) and 503 (module not configured for this
  // tenant — C-15) both mean "not available right now" → the same calm info toast.
  const bulkCouple = (target: CoupleTarget) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    setSelectedIds(new Set())
    const targetLabel = t(`bulk.target.${target}`)
    api.post('/sync/matches/bulk', { ids, system: target })
      .then(res => {
        const queued = Array.isArray(res.data?.queued) ? res.data.queued.length : 0
        const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped.length : 0
        if (skipped > 0) notify('info', t('bulk.coupleQueuedPartial', { target: targetLabel, queued, total: queued + skipped, skipped }))
        else notify('success', t('bulk.coupleQueued', { target: targetLabel, count: queued }))
      })
      .catch(err => {
        if (err?.response?.status === 404 || isServiceUnavailable(err)) notify('info', t('bulk.coupleUnavailable'))
        else notify('error', t('bulk.mutateError'))
      })
  }

  return {
    toggleRow,
    toggleAll,
    bulkCoupleHelloFlex:    () => bulkCouple('helloflex'),
    bulkCoupleShiftmanager: () => bulkCouple('shiftmanager'),
  }
}
