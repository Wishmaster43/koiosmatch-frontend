/**
 * useMatchesBulkActions — bulk operations for MatchesPage. A match is read-only
 * (§3B: the continuation of an application → placement), so the only bulk
 * operations are row/all selection and authorization-gated *coupling* to an
 * external backoffice (HelloFlex / ShiftManager). The backend queues +
 * rate-limits the coupling and returns the queued/updated ids; because nothing
 * on the row changes there is no optimistic patch. Toasts come from the shared
 * notifier so a bulk action never fails silently (§10).
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
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

  // Queue the selection for backoffice coupling. 404 = endpoint not built yet →
  // a calm info toast (forward-compatible), not a hard error.
  const bulkCouple = (target: CoupleTarget) => {
    const ids = [...selectedIds]
    if (!ids.length) return
    api.post('/matches/bulk/couple', { match_ids: ids, target })
      .then(res => {
        const list = res.data?.queued ?? res.data?.updated
        const n = Array.isArray(list) ? list.length : ids.length
        notify('success', t('bulk.coupleQueued', { target: t(`bulk.target.${target}`), count: n }))
      })
      .catch(err => {
        if (err?.response?.status === 404) notify('info', t('bulk.coupleUnavailable'))
        else notify('error', t('bulk.mutateError'))
      })
    setSelectedIds(new Set())
  }

  return {
    toggleRow,
    toggleAll,
    bulkCoupleHelloFlex:    () => bulkCouple('helloflex'),
    bulkCoupleShiftManager: () => bulkCouple('shiftmanager'),
  }
}
