/**
 * Candidate talent-pool hooks — the tenant pool list (GET /pools) and a single
 * candidate's pool membership (the candidate_pool pivot via /candidates/{id}/pools).
 * Kept out of the components (PoolsSection / CandidatesBulkBar) so those stay
 * presentational (§3: logic in hooks, not JSX). The list GET soft-fails (empty
 * until /pools exists); membership writes are optimistic and surface notifyError
 * on failure (ERR-1). Richer than lib/usePools (which returns names only).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import { isAbortError } from '@/lib/abortError'
import type { Candidate, CandidatePool } from '@/types/candidate'
import type { Id } from '@/types/common'

// Tenant pool list (GET /pools) as full objects. The list itself stays soft-fail
// (an empty list is fine for an optional chip picker), but a REAL failure must
// still be distinguishable from "this tenant has no pools" (R8) — `onError` is an
// additive, optional escape hatch for a caller that wants to know (useCandidatePools
// below); the plain array return (CandidatesBulkBar's call site) is unchanged.
export function useTenantPools(onError?: () => void): CandidatePool[] {
  const [pools, setPools] = useState<CandidatePool[]>([])
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/pools', { params: { active: 1 }, signal: ctrl.signal })
      .then(r => setPools(unwrapList<CandidatePool>(r).rows))
      .catch(err => { if (!isAbortError(err)) onError?.() })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once load; onError is a caller-supplied callback, not a value this effect should re-run for
  }, [])
  return pools
}

// A candidate's pool membership: local optimistic chips + persisted add/remove.
export function useCandidatePools(candidate: Candidate) {
  const { t } = useTranslation('candidates')
  // A failed /pools load must be distinguishable from "this tenant has no pools" (R8).
  const [allPoolsError, setAllPoolsError] = useState(false)
  const allPools = useTenantPools(() => setAllPoolsError(true))
  const [pools, setPools] = useState<CandidatePool[]>(candidate.pools ?? [])

  // Is the candidate already in this pool (id or, for bare slugs, name)?
  const has = (id: Id | undefined) => pools.some(p => (p.id ?? p.name) === id)

  // Optimistic add/remove, persisted to the pivot route. BUG CLASS FIX: a failed
  // request used to only toast — the chip stayed in the state the server rejected.
  // Snapshot only the ONE pool being toggled (never the whole list, so a parallel
  // toggle of another pool is never clobbered by this revert) and put it back on failure.
  const toggle = (pool: CandidatePool) => {
    const id = pool.id ?? pool.name
    if (has(id)) {
      const removed = pools.find(p => (p.id ?? p.name) === id)
      setPools(prev => prev.filter(p => (p.id ?? p.name) !== id))
      api.delete(`/candidates/${candidate.id}/pools/${id}`).catch(err => {
        if (removed) setPools(prev => (prev.some(p => (p.id ?? p.name) === id) ? prev : [...prev, removed]))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    } else {
      setPools(prev => [...prev, pool])
      api.post(`/candidates/${candidate.id}/pools`, { pool_id: id }).catch(err => {
        setPools(prev => prev.filter(p => (p.id ?? p.name) !== id))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }

  return { pools, allPools, allPoolsError, has, toggle }
}
