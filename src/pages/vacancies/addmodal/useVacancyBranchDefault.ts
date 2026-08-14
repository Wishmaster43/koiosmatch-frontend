/**
 * useVacancyBranchDefault — VAC-VESTIGING-1: proposes the picked customer's own
 * mirrored bureau branch (vestiging) into the create form's `branchId`. Mirrors
 * MatchModal's `useBranchDefault` propose-but-freeze-on-edit idiom: the proposal
 * recomputes on every customer switch until the recruiter edits the branch field
 * by hand, then `branchDirty` freezes it for good. Cosmetic default only — the
 * field stays fully optional/clearable either way (VAC-CLEAR-1).
 */
import { useState, useEffect } from 'react'
import { useCustomerCascade } from '../hooks/useCustomerCascade'

export function useVacancyBranchDefault(clientId: string, setBranchId: (v: string) => void) {
  const { detail } = useCustomerCascade(clientId)
  const [branchDirty, setBranchDirty] = useState(false)

  // Re-propose the customer's mirrored branch on every customer switch, but only
  // while the recruiter has not touched the branch field by hand.
  useEffect(() => {
    if (branchDirty) return
    const customerBranch = detail?.branch_id
    setBranchId(customerBranch != null ? String(customerBranch) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-propose on the resolved customer detail / dirty flag, never on setBranchId's identity
  }, [detail, branchDirty])

  // A manual pick (including the clear-X) freezes the proposal for the rest of
  // this create session — mirrors useBranchDefault's own handleBranchChange.
  const handleBranchChange = (v: string) => { setBranchDirty(true); setBranchId(v) }

  return { handleBranchChange }
}
