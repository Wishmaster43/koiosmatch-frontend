/**
 * useEntityBranches — the shared branch-membership hook (M2M) behind the shared
 * BranchSection component, generic over which entity owns the coupling. Persists
 * via POST/DELETE {prefix}/{id}/branches; the body key is `location_id` on every
 * entity (CandidateBranchController / CustomerBranchController share the same
 * contract). Mirrors useEntityDocuments (§3/§11: one hook, parameterised, reused
 * across entities rather than copied per entity).
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { Id } from '@/types/common'
import type { BranchOption, EntityBranch } from './BranchSection'

interface UseEntityBranchesArgs {
  // URL plural token the branch routes hang off (e.g. 'customers'). Candidates
  // keep their own useCandidateBranches (§11 — out of this change's scope); this
  // generic hook is the one new callers (customers, and any future entity) wire to.
  prefix: string
  id: Id | undefined
  // The full pickable list (GET /locations) — supplied by the caller's own
  // locations hook so this file never fetches the tenant's establishment list itself.
  options: BranchOption[]
  // The entity's own resource does not embed its branch membership (unlike a
  // candidate, which already carries `branches[]`) — pull it once via
  // GET {prefix}/{id}/branches (VESTIGING-2 fase 4) instead of assuming it is preloaded.
  fetchOnMount?: boolean
  initialBranches?: EntityBranch[]
}

// Generic branch-membership hook behind BranchSection (see file docblock above),
// parameterised by URL prefix so every entity shares one implementation.
export function useEntityBranches({ prefix, id, options, fetchOnMount = false, initialBranches = [] }: UseEntityBranchesArgs) {
  const { t } = useTranslation('common')
  const [branches, setBranches] = useState<EntityBranch[]>(initialBranches)

  // Hydrate the current membership once for entities with no embedded field.
  useEffect(() => {
    if (!fetchOnMount || !id) return
    let alive = true
    api.get(`/${prefix}/${id}/branches`)
      .then(res => { if (alive) setBranches(unwrapList<EntityBranch>(res).rows) })
      .catch(() => { if (alive) setBranches([]) })
    return () => { alive = false }
  }, [fetchOnMount, prefix, id])

  // Membership key: prefer the id, fall back to the name for bare-slug branches.
  const keyOf = (b: EntityBranch) => String(b.id ?? b.name)
  const selectedIds = branches.map(keyOf)

  // Optimistic add/remove, persisted to the pivot route. A failed request reverts
  // ONLY the one branch being toggled (never the whole list), so a parallel toggle
  // of another branch survives the revert (mirrors useCandidateBranches).
  const toggle = (branchId: string) => {
    if (!id) return
    if (selectedIds.includes(branchId)) {
      const removed = branches.find(b => keyOf(b) === branchId)
      setBranches(prev => prev.filter(b => keyOf(b) !== branchId))
      api.delete(`/${prefix}/${id}/branches/${branchId}`).catch(err => {
        if (removed) setBranches(prev => (prev.some(b => keyOf(b) === branchId) ? prev : [...prev, removed]))
        notifyError(extractApiError(err, t('actionFailed')))
      })
    } else {
      const name = options.find(o => o.value === branchId)?.label ?? branchId
      setBranches(prev => [...prev, { id: branchId, name }])
      api.post(`/${prefix}/${id}/branches`, { location_id: branchId }).catch(err => {
        setBranches(prev => prev.filter(b => keyOf(b) !== branchId))
        notifyError(extractApiError(err, t('actionFailed')))
      })
    }
  }

  return { branches, selectedIds, toggle }
}
