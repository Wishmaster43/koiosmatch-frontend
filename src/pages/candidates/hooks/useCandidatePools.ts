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
import type { Candidate, CandidatePool } from '@/types/candidate'
import type { Id } from '@/types/common'

// Tenant pool list (GET /pools) as full objects; tolerant of a missing endpoint.
export function useTenantPools(): CandidatePool[] {
  const [pools, setPools] = useState<CandidatePool[]>([])
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/pools', { signal: ctrl.signal })
      .then(r => setPools(unwrapList<CandidatePool>(r).rows))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  return pools
}

// A candidate's pool membership: local optimistic chips + persisted add/remove.
export function useCandidatePools(candidate: Candidate) {
  const { t } = useTranslation('candidates')
  const allPools = useTenantPools()
  const [pools, setPools] = useState<CandidatePool[]>(candidate.pools ?? [])

  // Is the candidate already in this pool (id or, for bare slugs, name)?
  const has = (id: Id | undefined) => pools.some(p => (p.id ?? p.name) === id)

  // Optimistic add/remove, persisted to the pivot route; notifyError on failure.
  const toggle = (pool: CandidatePool) => {
    const id = pool.id ?? pool.name
    if (has(id)) {
      setPools(prev => prev.filter(p => (p.id ?? p.name) !== id))
      api.delete(`/candidates/${candidate.id}/pools/${id}`).catch(() => notifyError(t('common:actionFailed')))
    } else {
      setPools(prev => [...prev, pool])
      api.post(`/candidates/${candidate.id}/pools`, { pool_id: id }).catch(() => notifyError(t('common:actionFailed')))
    }
  }

  return { pools, allPools, has, toggle }
}
