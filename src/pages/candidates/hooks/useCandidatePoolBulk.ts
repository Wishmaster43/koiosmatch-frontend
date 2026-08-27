/**
 * useCandidatePoolBulk — the pool add/remove cluster split out of
 * useCandidateBulkActions (§3 size split, > ~400-line trigger): optimistic
 * patch, persist, reconcile against the server's `added`/`removed` list,
 * revert on failure. `notifyOutcome` is owned by the parent hook (shared
 * across every bulk cluster) and passed in so there is exactly one
 * implementation of it.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import api from '@/lib/api'
import type { Candidate, CandidatePool } from '@/types/candidate'
import type { Id } from '@/types/common'

interface UseCandidatePoolBulkParams {
  candidates: Candidate[]
  setCandidates: Dispatch<SetStateAction<Candidate[]>>
  selectedIds: Set<Id>
  setSelectedIds: Dispatch<SetStateAction<Set<Id>>>
  notify: (type: string, msg: string) => void
  t: TFunction
  notifyOutcome: (successKey: string, params: Record<string, unknown>, updated: number, total: number) => void
}

export function useCandidatePoolBulk({
  candidates, setCandidates, selectedIds, setSelectedIds, notify, t, notifyOutcome,
}: UseCandidatePoolBulkParams) {
  // Add the selection to a pool: patch the pool column optimistically, persist,
  // and revert + warn on failure (only candidates lacking the pool change).
  const bulkAddToPool = (pool: CandidatePool) => {
    const ids = [...selectedIds]
    if (!ids.length || !pool) return
    const poolId = pool.id ?? pool.name
    const chip: CandidatePool = { id: pool.id, name: pool.name, color: pool.color }
    const changedIds = candidates.filter(c => ids.includes(c.id) && !(c.pools ?? []).some(p => (p.id ?? p.name) === poolId)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
    api.post(`/pools/${poolId}/candidates`, { candidate_ids: ids })
      .then((res) => {
        const added = Array.isArray(res.data?.added) ? new Set(res.data.added) : null
        if (added) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !added.has(c.id))
          ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
        notifyOutcome('bulk.addedToPool', { pool: pool.name }, added ? added.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
        notify('error', t('bulk.poolError'))
      })
    setSelectedIds(new Set())
  }
  // Remove the selection from a pool: same optimistic + revert pattern.
  const bulkRemoveFromPool = (pool: CandidatePool) => {
    const ids = [...selectedIds]
    if (!ids.length || !pool) return
    const poolId = pool.id ?? pool.name
    const chip: CandidatePool = { id: pool.id, name: pool.name, color: pool.color }
    const changedIds = candidates.filter(c => ids.includes(c.id) && (c.pools ?? []).some(p => (p.id ?? p.name) === poolId)).map(c => c.id)
    setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: (c.pools ?? []).filter(p => (p.id ?? p.name) !== poolId) } : c))
    api.delete(`/pools/${poolId}/candidates`, { data: { candidate_ids: ids } })
      .then((res) => {
        const removed = Array.isArray(res.data?.removed) ? new Set(res.data.removed) : null
        if (removed) setCandidates(prev => prev.map(c => (changedIds.includes(c.id) && !removed.has(c.id))
          ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
        notifyOutcome('bulk.removedFromPool', { pool: pool.name }, removed ? removed.size : changedIds.length, changedIds.length)
      })
      .catch(() => {
        setCandidates(prev => prev.map(c => changedIds.includes(c.id) ? { ...c, pools: [...(c.pools ?? []), chip] } : c))
        notify('error', t('bulk.poolError'))
      })
    setSelectedIds(new Set())
  }

  return { bulkAddToPool, bulkRemoveFromPool }
}
