/**
 * useBranchMismatch — the candidate's own branch (vestiging) vs the picked
 * customer's branch (fase 3). Loads the candidate's branch once and flags a
 * mismatch (both sides nullable, §3B) so the form can offer a calm inline
 * choice: keep this placement on the customer's branch (default) or also move
 * the candidate's branch along. Split out of useMatchPlacementForm (audit R1
 * item 1, MUST-SPLIT) — a self-contained concern, independent of the rest of
 * the form's relations/contract/financial state.
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import type { Id } from '@/types/common'

export function useBranchMismatch(candidateId: Id | string, detail: CustomerCascadeDetail | null) {
  const [candBranch, setCandBranch] = useState<{ id: Id | null; name: string } | null>(null)
  // 'placement' = only this placement keeps the customer's branch (default);
  // 'candidate' = also move the candidate's branch to the customer's.
  const [mismatchChoice, setMismatchChoice] = useState<'placement' | 'candidate'>('placement')

  // Load the candidate's branch once — needed for the mismatch check.
  useEffect(() => {
    if (!candidateId) { setCandBranch(null); return }
    let alive = true
    api.get(`/candidates/${candidateId}`)
      .then(r => {
        if (!alive) return
        const d = (unwrap(r)) as { branch_id?: Id | null; location?: { name?: string } | null }
        setCandBranch({ id: d?.branch_id ?? null, name: d?.location?.name ?? '' })
      })
      .catch(() => { if (alive) setCandBranch(null) })
    return () => { alive = false }
  }, [candidateId])

  // Mismatch only counts when BOTH sides actually carry a branch (§3B: nullable).
  const branchMismatch = Boolean(candBranch?.id && detail?.branch_id && String(candBranch.id) !== String(detail.branch_id))

  return { candBranch, mismatchChoice, setMismatchChoice, branchMismatch }
}
