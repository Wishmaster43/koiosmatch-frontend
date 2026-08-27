/**
 * useApplicationOwnerChain — APPMODAL-SPLIT-1: the owner-derivation sub-region
 * (measured AddApplicationModal.tsx 188-231) extracted verbatim out of
 * useAddApplicationForm, behaviour unchanged. Owns the APP-OWNER-1 priority
 * chain (picked vacancy's own recruiter > candidate's own owner > logged-in
 * user, every rung ASSIGNABLE-only), the manual-override ref that stops the
 * auto-seed once the recruiter (or an edit-mode prefill) has picked
 * explicitly, and the OWNER-DEVIATION-1 soft-warning booleans.
 */
import { useState, useRef, useEffect } from 'react'
import type { Id } from '@/types/common'
import type { VacancyOption } from './useVacancyOptions'

export function useApplicationOwnerChain({
  pickedVacancy, candidateOwnerId, userOptions, meId, meIsAssignable,
}: {
  pickedVacancy: VacancyOption | undefined
  candidateOwnerId?: Id | null
  userOptions: { value: string; label: string }[]
  meId?: Id
  meIsAssignable: boolean
}) {
  // APP-OWNER-1: derivation chain, highest priority first — the picked vacancy's
  // own recruiter (owner) > the candidate's own owner (prop) > the logged-in user
  // (the old OWNER-DEVIATION-1 default). Every rung only proposes a real,
  // ASSIGNABLE tenant user. Evaluated fresh every render from its three inputs.
  const vacancyOwnerId = pickedVacancy?.ownerId
  const vacancyOwnerAssignable = vacancyOwnerId != null && userOptions.some(o => o.value === String(vacancyOwnerId))
  const candidateOwnerAssignable = candidateOwnerId != null && userOptions.some(o => o.value === String(candidateOwnerId))
  const derivedOwnerId = vacancyOwnerAssignable ? String(vacancyOwnerId)
    : candidateOwnerAssignable ? String(candidateOwnerId)
    : meIsAssignable ? String(meId)
    : ''

  // Seeded from the chain above, never re-seeded once the recruiter makes a MANUAL
  // pick (tracked by a ref, not by "ownerId is already set" — unlike
  // usePlanIntakeForm's RECRUITER-DEFAULT-1, whose two inputs both resolve together
  // off the same /users load, this chain's highest-priority input — the vacancy
  // pick — can arrive LATER than a lower-priority auto-seed already did, and it
  // still must be able to promote itself over that earlier auto-seed).
  const [ownerId, setOwnerIdState] = useState('')
  const ownerManualRef = useRef(false)
  // Adopts the derived owner whenever a higher-priority rung resolves later than a
  // lower one already auto-seeded, but never once the recruiter has picked manually.
  useEffect(() => {
    if (ownerManualRef.current) return
    if (derivedOwnerId && derivedOwnerId !== ownerId) setOwnerIdState(derivedOwnerId)
  }, [derivedOwnerId]) // eslint-disable-line react-hooks/exhaustive-deps
  // The picker's own onChange (and edit-mode's prefill) — any explicit set
  // permanently stops the auto-seed above.
  const setOwnerId = (v: string) => { ownerManualRef.current = true; setOwnerIdState(v) }

  // OWNER-DEVIATION-1: a soft warning, never a block (Danny: "wel een melding") —
  // the FINAL recruiter still differs from the candidate's own owner and/or the
  // picked vacancy's owner (e.g. after a manual override). Both sides must be a
  // KNOWN owner to compare (an unowned candidate/vacancy is not a "deviation",
  // mirroring useBranchMismatch's own "both sides nullable" rule) — never claims a
  // mismatch against an unknown "—".
  const ownerDiffersFromCandidate = Boolean(
    ownerId && candidateOwnerId != null && String(candidateOwnerId) !== String(ownerId))
  const ownerDiffersFromVacancy = Boolean(
    ownerId && pickedVacancy?.ownerId != null && String(pickedVacancy.ownerId) !== String(ownerId))

  return { ownerId, setOwnerId, ownerDiffersFromCandidate, ownerDiffersFromVacancy }
}
