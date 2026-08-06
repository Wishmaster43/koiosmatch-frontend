/**
 * matchConflicts — pure client-side checks over the candidate's OWN existing
 * matches (Danny's ten-point round, points 5/6 — 1.10/1.11 "duplicate + overlap").
 * Both run over the SAME already-fetched list (useExistingCandidateMatches) —
 * "client-side over real data", no extra backend surface. Kept as plain, fully
 * unit-testable functions (no hooks) so the trickiest date-range math is covered
 * in isolation, mirroring the house's `cascadeValue`/`findDuplicateContact` idiom
 * in this same folder's helpers.ts.
 *
 * WARN, NEVER BLOCK (house rule, §3A action-matrix spirit + Danny's explicit
 * "never block" here): both functions only ever produce data for an inline
 * banner — nothing here gates `handleSubmitClick`.
 */
import type { Id } from '@/types/common'

// The subset of a /matches list row this module needs — mapped defensively by
// useExistingCandidateMatches from MatchListResource's real fields.
export interface ExistingMatchRow {
  id: Id
  vacancyTitle: string | null
  client: string | null
  customerId: string | null
  customerLocationId: string | null
  customerDepartmentId: string | null
  // Lifecycle status SLUG (resolved to active/closed via useMatchStatuses, never
  // string-matched here) — see `isActiveStatus` at the call site.
  status: string | null
  startDate: string | null
  endDate: string | null
}

/**
 * findDuplicateMatch — an existing match for the SAME candidate + customer
 * (+ location/department where the DRAFT actually specifies them). Only the
 * levels the recruiter has picked so far are compared: an unset draft level
 * never excludes a broader existing match (mirrors `cascadeValue`'s deepest-
 * picked-level reasoning). Returns the first match, or null.
 */
export function findDuplicateMatch(
  matches: ExistingMatchRow[], customerId: string, locationId: string, departmentId: string,
): ExistingMatchRow | null {
  if (!customerId) return null
  return matches.find(m =>
    String(m.customerId ?? '') === customerId
    && (!locationId || String(m.customerLocationId ?? '') === locationId)
    && (!departmentId || String(m.customerDepartmentId ?? '') === departmentId)
  ) ?? null
}

// Two [start,end] date ranges (YYYY-MM-DD strings) overlap — a null end reads as
// "still ongoing" (an open-ended assignment), never as "no period at all".
const OPEN_ENDED = '9999-12-31'
function rangesOverlap(aStart: string, aEnd: string | null, bStart: string | null, bEnd: string | null): boolean {
  if (!aStart || !bStart) return false // an unset start on either side can't be compared yet
  const aE = aEnd || OPEN_ENDED
  const bE = bEnd || OPEN_ENDED
  return aStart <= bE && bStart <= aE
}

/**
 * findOverlappingMatches — every ACTIVE existing match (across ALL customers —
 * a double-booking risk exists between employers too, not just within one) whose
 * period overlaps the drafted start/end. `isActiveStatus` resolves the tenant's
 * match-status lookup; a status this form cannot resolve is treated as ACTIVE
 * (a false warning is safe, a missed one is not — mirrors the house's
 * warn-over-silence bias).
 */
export function findOverlappingMatches(
  matches: ExistingMatchRow[], startDate: string, endDate: string, isActiveStatus: (status: string | null) => boolean,
): ExistingMatchRow[] {
  if (!startDate) return []
  return matches.filter(m => isActiveStatus(m.status) && rangesOverlap(startDate, endDate || null, m.startDate, m.endDate))
}
