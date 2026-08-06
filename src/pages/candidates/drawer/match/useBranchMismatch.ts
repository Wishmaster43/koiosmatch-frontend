/**
 * useBranchMismatch — the candidate's own branch (vestiging) vs the picked
 * customer's branch (fase 3). Loads the candidate's branch once and flags a
 * mismatch (both sides nullable, §3B) so the form can offer a calm inline
 * choice: keep this match on the customer's branch (default) or also move
 * the candidate's branch along. Split out of useMatchForm (audit R1
 * item 1, MUST-SPLIT) — a self-contained concern, independent of the rest of
 * the form's relations/contract/financial state.
 *
 * RECRUITER-DEFAULT-1 (point 3, Danny's ten-point round): this GET
 * /candidates/{id} is already fetched for the branch check above — the SAME
 * response also carries the candidate's own owner, so `candOwnerId` rides
 * along on this one fetch (no second request) as the fallback source for the
 * recruiter/owner derivation chain in useMatchForm, for the scenario where the
 * candidate isn't already known up front (candidate picked IN this form, e.g.
 * the Matches-page/customer-drilldown candidate-less mode) and so has no
 * `candidateOwnerId` prop to read from (mirrors usePlanIntakeForm's own
 * "already-loaded drawer record, never refetched" comment for the FIXED-candidate
 * case — this is only the fallback for the picked-candidate case).
 */
import { useState, useEffect } from 'react'
import api, { unwrap } from '@/lib/api'
import type { CustomerCascadeDetail } from '@/hooks/useCustomerCascade'
import type { Id } from '@/types/common'

export function useBranchMismatch(candidateId: Id | string, detail: CustomerCascadeDetail | null) {
  const [candBranch, setCandBranch] = useState<{ id: Id | null; name: string } | null>(null)
  // Candidate's own owner (RECRUITER-DEFAULT-1) — null until the fetch below resolves.
  const [candOwnerId, setCandOwnerId] = useState<Id | null>(null)
  // 'match' = only this match keeps the customer's branch (default);
  // 'candidate' = also move the candidate's branch to the customer's.
  const [mismatchChoice, setMismatchChoice] = useState<'match' | 'candidate'>('match')

  // Load the candidate's branch (+ owner) once — needed for the mismatch check
  // and the recruiter-default fallback.
  useEffect(() => {
    if (!candidateId) { setCandBranch(null); setCandOwnerId(null); return }
    let alive = true
    api.get(`/candidates/${candidateId}`)
      .then(r => {
        if (!alive) return
        const d = (unwrap(r)) as {
          branch_id?: Id | null; location?: { name?: string } | null
          owner?: { id?: Id } | null; owner_id?: Id | null
        }
        setCandBranch({ id: d?.branch_id ?? null, name: d?.location?.name ?? '' })
        setCandOwnerId(d?.owner?.id ?? d?.owner_id ?? null)
      })
      .catch(() => { if (alive) { setCandBranch(null); setCandOwnerId(null) } })
    return () => { alive = false }
  }, [candidateId])

  // Mismatch only counts when BOTH sides carry a branch AND the customer's
  // branch has a resolvable NAME — "wijkt af van (—)" is an unbackable claim
  // (Danny 24-07). Seeder guarantee (every customer/candidate on a branch) is
  // ticketed BE-side; until then unknown = no banner.
  const branchMismatch = Boolean(
    candBranch?.id && detail?.branch_id && detail?.branch?.name
    && String(candBranch.id) !== String(detail.branch_id))

  return { candBranch, candOwnerId, mismatchChoice, setMismatchChoice, branchMismatch }
}
