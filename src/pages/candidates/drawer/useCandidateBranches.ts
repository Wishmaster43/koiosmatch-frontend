/**
 * useCandidateBranches — the candidate's branch (vestiging) membership (C-4, M2M):
 * local optimistic chips + persisted add/remove via /candidates/{id}/branches;
 * notifyError on failure (ERR-1). Tolerant while the backend endpoint is being
 * (re)built — the options GET soft-fails too.
 *
 * DRY (CANDHOOKS r10): folded back from pages/candidates/hooks/useCandidateDrawerData.ts,
 * which exported this with exactly ONE consumer (this file's own BranchSection.tsx) —
 * a false "shared hooks" appearance for a hook only ever used here. The generic
 * components/drawer/useEntityBranches.ts is NOT a drop-in replacement: a candidate's
 * own resource already embeds its branch membership (no GET route, unlike a
 * customer's dedicated endpoint — see that file's own doc comment), so this stays the
 * candidate's own implementation, now co-located with its only consumer instead of
 * living in a file that looks shared but is not.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import type { Candidate, CandidateBranch } from '@/types/candidate'
import type { Id } from '@/types/common'

interface BranchOption { value: string; label: string }

interface LocationLite { name?: string; id?: Id }

// Tenant vestigingen (GET /locations — the settings/company/locations lookup) as
// id-keyed {value,label} options for the
// branch link — value is the location id so membership can persist by id (C-4).
// Danny ronde-2 punt 1: this listed CUSTOMERS (wrong entity — the backend's
// exists:locations rule 422'd every save); branches ARE the tenant's own
// vestigingen from settings/company/locations.
// Module-local (not exported): its only caller is useCandidateBranches below.
function useBranchLocationOptions(): BranchOption[] {
  const { data = [] } = useQuery({
    queryKey: ['locations', 'branch-options'],
    queryFn: async ({ signal }): Promise<BranchOption[]> => {
      const rows = unwrapList<LocationLite>(await api.get('/locations', { signal })).rows
      return rows
        .map(l => { const name = String(l.name ?? l.id ?? ''); return { value: String(l.id ?? name), label: name } })
        .filter(o => o.value && o.label)
    },
  })
  return data
}

// A candidate's branch membership (C-4, M2M): local optimistic chips + persisted
// add/remove via /candidates/{id}/branches; notifyError on failure (ERR-1). Tolerant
// while the backend endpoint is being (re)built — the options GET soft-fails too.
export function useCandidateBranches(candidate: Candidate) {
  const { t } = useTranslation('candidates')
  const options = useBranchLocationOptions()
  const [branches, setBranches] = useState<CandidateBranch[]>(candidate.branches ?? [])

  // Membership key: prefer the id, fall back to the name for bare-slug branches.
  const keyOf = (b: CandidateBranch) => String(b.id ?? b.name)
  const selectedIds = branches.map(keyOf)

  // Optimistic add/remove, persisted to the pivot route. Body key is location_id —
  // the controller validates exists:locations (the old branch_id key 422'd silently).
  // BUG CLASS FIX: a failed request used to only toast — the chip stayed in the
  // state the server rejected. Snapshot only the ONE branch being toggled (never
  // the whole list, so a parallel toggle of another branch is never clobbered by
  // this revert) and put it back on failure.
  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      const removed = branches.find(b => keyOf(b) === id)
      setBranches(prev => prev.filter(b => keyOf(b) !== id))
      api.delete(`/candidates/${candidate.id}/branches/${id}`).catch(err => {
        if (removed) setBranches(prev => (prev.some(b => keyOf(b) === id) ? prev : [...prev, removed]))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    } else {
      const name = options.find(o => o.value === id)?.label ?? id
      setBranches(prev => [...prev, { id, name }])
      api.post(`/candidates/${candidate.id}/branches`, { location_id: id }).catch(err => {
        setBranches(prev => prev.filter(b => keyOf(b) !== id))
        notifyError(extractApiError(err, t('common:actionFailed')))
      })
    }
  }

  return { branches, options, selectedIds, toggle }
}
