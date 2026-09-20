/**
 * useVacancyBranchDefault — VAC-VESTIGING-1 + fallback: proposes a branch
 * (vestiging) into the create form's `branchId`, deepest-first: the picked
 * customer's own mirrored bureau branch first, else the logged-in recruiter's
 * first linked branch (useAuth().user.branch_ids[0]). Mirrors MatchModal's
 * `useBranchDefault` propose-but-freeze-on-edit idiom: the proposal recomputes
 * on every customer switch until the recruiter edits the branch field by hand,
 * then `branchDirty` freezes it for good. Cosmetic default only — the field
 * stays fully optional/clearable either way (VAC-CLEAR-1). This is a
 * DERIVATION, not explicit context (§0/KOIOS-VOORSTEL-1), so the caller shows
 * the KoiosSuggestionBadge while the current value still equals this
 * proposal — mirrors useVacancyAgentDefault's identical idiom.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCustomerCascade } from '../hooks/useCustomerCascade'

// Proposes the customer's mirrored branch, falling back to the recruiter's own
// first branch; freezing once edited by hand — see the module doc comment above.
export function useVacancyBranchDefault(clientId: string, setBranchId: (v: string) => void) {
  const auth = useAuth()
  const me = auth?.user
  // Primitive dependencies on purpose (K-284): the effect below keys on THESE strings,
  // never on the user object itself (a mock or provider that hands out a fresh object
  // per render would otherwise re-propose on every render and loop into an out-of-memory crash).
  const recruiterDefaultBranch = me?.default_branch_id
  const recruiterFirstBranch = me?.branch_ids?.[0]
  const { detail } = useCustomerCascade(clientId)
  const [branchDirty, setBranchDirty] = useState(false)
  const customerBranch = detail?.branch_id
  const proposed = customerBranch ?? recruiterDefaultBranch ?? recruiterFirstBranch

  // Re-propose the customer's branch or fall back to the recruiter's default/first branch
  // on every customer switch, but only while the recruiter has not touched the
  // branch field by hand (propose-but-freeze).
  useEffect(() => {
    if (branchDirty) return
    setBranchId(proposed != null ? String(proposed) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-propose on the resolved proposal / dirty flag, never on setBranchId's identity
  }, [proposed, branchDirty])

  // A manual pick (including the clear-X) freezes the proposal for the rest of
  // this create session — mirrors useBranchDefault's own handleBranchChange.
  const handleBranchChange = (v: string) => { setBranchDirty(true); setBranchId(v) }

  // The badge shows only while the current value still IS the live proposal (never after a manual pick/clear).
  const showBranchSuggestion = !branchDirty && proposed != null

  return { handleBranchChange, showBranchSuggestion }
}
