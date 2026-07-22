/**
 * useBranchDefault — proposes a branch (vestiging) for the placement (7.4,
 * MATCH-BRANCH-DEFAULT-1): the picked customer's own branch first, else the
 * recruiter's own first linked branch (`useAuth().user.branch_ids[0]` — the
 * ME-BRANCHES-1 view-set already shipped and used the same way in
 * AddCandidateModal), else the tenant-wide default location (`useLocations()`'s
 * `is_default` row). AuthContext is read-only here (§14 — never written to).
 * Mirrors useCascadeDefaults' propose-but-freeze-on-edit pattern (job 21/22):
 * the proposal recomputes on every customer pick until the recruiter edits the
 * field by hand, then `branchDirty` freezes it for good.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { LocationOption } from '@/lib/useLocations'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'

export function useBranchDefault(detail: CustomerCascadeDetail | null, locations: LocationOption[]) {
  // Defensive cast (mirrors AddCandidateModal's own read of branch_ids) — the
  // shared AuthUser type doesn't declare this field yet, but ME-BRANCHES-1 ships it.
  const { user: me } = useAuth() as unknown as { user: { branch_ids?: Array<string | number> } | null }
  const [branchId, setBranchId] = useState('')
  const [branchDirty, setBranchDirty] = useState(false)

  // Deepest-first proposal: customer branch > recruiter's own branch > tenant default.
  useEffect(() => {
    if (branchDirty) return
    const customerBranch = detail?.branch_id
    const recruiterBranch = me?.branch_ids?.[0]
    const tenantDefault = locations.find(l => l.is_default)?.value
    const proposed = customerBranch ?? recruiterBranch ?? tenantDefault
    setBranchId(proposed != null ? String(proposed) : '')
  }, [detail, me, locations, branchDirty])

  return { branchId, setBranchId, setBranchDirty }
}
