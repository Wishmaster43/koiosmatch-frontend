/**
 * useRecruiterDefault — RECRUITER-DEFAULT-1 for the match form (point 3, Danny's
 * ten-point round). Mirrors `planIntake/usePlanIntakeForm.ts`'s own
 * RECRUITER-DEFAULT-1 exactly: same seeded-once semantics (`ownerId` itself is
 * the guard — nothing in this form ever resets a picked owner back to '', so this
 * never re-fires after a manual pick or an earlier auto-seed) and the same
 * `meIsAssignable`-style guard (never proposes a login the server would 422 on
 * because it isn't a real assignable tenant user). CREATE only.
 *
 * Two owner sources, in priority order:
 *  1. `candidateOwnerId` — passed down from an already-loaded drawer record
 *     (WorkTab's `c.ownerId`, mirrors AddApplicationModal/PlanIntakeModal, never
 *     refetched) when the modal opened on a FIXED candidate.
 *  2. `candOwnerId` — fetched by the sibling `useBranchMismatch` (which already
 *     GETs this candidate for the branch-mismatch check; reused here, not
 *     refetched) — the fallback for the candidate-LESS flow, where the
 *     candidate is picked INSIDE this form (Matches page / customer drilldown)
 *     and so carries no `candidateOwnerId` prop to read from.
 *  3. The logged-in user, same as before this ticket.
 */
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Id } from '@/types/common'

interface UserLike { id?: Id; name?: string }

// Seed the match form's owner once, in priority order: the candidate's own owner, the sibling-fetched fallback, then the logged-in user — never overwrites a manual pick.
export function useRecruiterDefault({
  editing, candidateOwnerId, candOwnerId, users,
}: {
  editing: boolean
  candidateOwnerId?: Id | null
  candOwnerId?: Id | null
  users: UserLike[]
}) {
  const { user: me } = useAuth() as unknown as { user: { id?: Id; name?: string } | null }
  const [ownerId, setOwnerId] = useState('')

  // Fires once (guarded by ownerId itself) while creating; skips a candidate owner who isn't actually assignable, mirroring the server's own check.
  useEffect(() => {
    if (editing || ownerId) return
    const preferred = candidateOwnerId ?? candOwnerId
    if (preferred != null && users.some(u => String(u.id) === String(preferred))) { setOwnerId(String(preferred)); return }
    if (me?.id != null && users.some(u => String(u.id) === String(me.id))) setOwnerId(String(me.id))
  }, [editing, ownerId, candidateOwnerId, candOwnerId, users, me])

  return { ownerId, setOwnerId }
}
