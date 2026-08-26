/**
 * useMatchConflicts — the duplicate + overlap preflight (points 5/6, Danny's
 * ten-point round: 1.10/1.11). Fetches the candidate's own matches once
 * (useExistingCandidateMatches) and derives both warnings client-side
 * (matchConflicts.ts) as the recruiter picks customer/location/department/dates.
 * WARN only — house rule: nothing here ever gates submit.
 */
import { useMatchStatuses } from '@/lib/useMatchStatuses'
import { useExistingCandidateMatches } from './useExistingCandidateMatches'
import { findDuplicateMatch, findOverlappingMatches } from './matchConflicts'
import type { Id } from '@/types/common'

// See the file's top doc above for the duplicate/overlap preflight this hook computes (warn-only, never gates submit).
export function useMatchConflicts({
  candidateId, editMatchId, customerId, locationId, departmentId, startDate, endDate,
}: {
  candidateId: string
  // Never warn a match against itself while editing it.
  editMatchId?: Id
  customerId: string; locationId: string; departmentId: string
  startDate: string; endDate: string
}) {
  const existingMatches = useExistingCandidateMatches(candidateId, editMatchId)
  // Resolve a stored status slug to its is_closed flag — an unresolvable status
  // (unknown slug) is treated as ACTIVE: a false warning is safe, a missed one isn't.
  const { metaOf } = useMatchStatuses()
  // Treats an unresolvable status slug as active, since a false warning is safe but a missed one is not.
  const isActiveStatus = (status: string | null) => {
    const meta = metaOf(status ?? undefined)
    return meta ? !meta.is_closed : true
  }

  const duplicateMatch = findDuplicateMatch(existingMatches, customerId, locationId, departmentId)
  const overlappingMatches = findOverlappingMatches(existingMatches, startDate, endDate, isActiveStatus)

  return { duplicateMatch, overlappingMatches }
}
