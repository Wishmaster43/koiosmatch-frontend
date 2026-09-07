/**
 * useOwnerDerivation — APPMODAL-SPLIT-1: shared owner-derivation chain
 * (APP-OWNER-1) for both drawer and page contexts. The chain is identical:
 * picked vacancy owner > candidate owner > logged-in user, every rung
 * ASSIGNABLE-only. Extracted from useApplicationOwnerChain and
 * useApplicationOwnerAndStage (1:1 behaviour unchanged for both).
 */
import { useState, useRef, useEffect } from 'react'
import type { Id } from '@/types/common'

export function useOwnerDerivation({
  vacancyOwnerId, candidateOwnerId, meId, userOptions, meIsAssignable,
}: {
  vacancyOwnerId?: Id | null
  candidateOwnerId?: Id | null
  meId?: Id
  userOptions: { value: string; label: string }[]
  meIsAssignable: boolean
}) {
  // APP-OWNER-1: derivation chain, highest priority first — the vacancy's own
  // recruiter (owner) > the candidate's own owner > the logged-in user. Every
  // rung only proposes a real, ASSIGNABLE tenant user.
  const vacancyOwnerAssignable = vacancyOwnerId != null && userOptions.some(o => o.value === String(vacancyOwnerId))
  const candidateOwnerAssignable = candidateOwnerId != null && userOptions.some(o => o.value === String(candidateOwnerId))
  const derivedOwnerId = vacancyOwnerAssignable ? String(vacancyOwnerId)
    : candidateOwnerAssignable ? String(candidateOwnerId)
    : meIsAssignable ? String(meId)
    : ''

  // Seeded from the chain above, never re-seeded once the recruiter makes a
  // MANUAL pick (tracked by a ref — a higher-priority input arriving later must
  // still be able to promote itself over an earlier lower-priority auto-seed).
  const [ownerId, setOwnerIdState] = useState('')
  const ownerManualRef = useRef(false)
  // Auto-seed the owner from the derived chain above, but never once the
  // recruiter has made a manual pick.
  useEffect(() => {
    if (ownerManualRef.current || !derivedOwnerId) return
    // Functional update: the effect never reads ownerId itself, so its deps stay exhaustive.
    setOwnerIdState(prev => (prev === derivedOwnerId ? prev : derivedOwnerId))
  }, [derivedOwnerId])
  // The picker's own onChange (and edit-mode prefill) — any explicit set
  // permanently stops the auto-seed above.
  const setOwnerId = (v: string) => { ownerManualRef.current = true; setOwnerIdState(v) }

  // OWNER-DEVIATION-1: a soft warning, never a block — the final recruiter still
  // differs from the candidate's own owner and/or the vacancy's owner (e.g. after
  // a manual override). Both sides must be a KNOWN owner to compare.
  const ownerDiffersFromCandidate = Boolean(
    ownerId && candidateOwnerId != null && String(candidateOwnerId) !== String(ownerId))
  const ownerDiffersFromVacancy = Boolean(
    ownerId && vacancyOwnerId != null && String(vacancyOwnerId) !== String(ownerId))

  return { ownerId, setOwnerId, ownerDiffersFromCandidate, ownerDiffersFromVacancy }
}
