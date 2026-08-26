/**
 * matchConflicts — pure client-side checks over the candidate's OWN existing
 * matches (Danny's ten-point round, points 5/6 — 1.10/1.11 "duplicate + overlap").
 * Both run over the SAME already-fetched list (useExistingCandidateMatches) —
 * "client-side over real data", no extra backend surface. Kept as plain, fully
 * unit-testable functions (no hooks) so the trickiest date-range math is covered
 * in isolation, mirroring the house's `cascadeValue`/`findDuplicateContact` idiom
 * in this same folder's helpers.ts.
 *
 * `overlapHoursSum` (below) is the hours-sum escalation on point 6: once
 * MATCH-LIST-HOURS-1 put `hours_per_week` on the /matches list row, an overlap
 * where the drafted hours + the existing match's hours together exceed a
 * full-time week reads as a real double-booking risk, not just an overlapping
 * date range — the caller (MatchConflictBanners) swaps in stronger wording.
 *
 * WARN, NEVER BLOCK (house rule, §3A action-matrix spirit + Danny's explicit
 * "never block" here): every function here only ever produces data for an inline
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
  // Contracted hours/week (MATCH-LIST-HOURS-1 — the list resource now serialises
  // it, tolerant-decimal-coerced by useExistingCandidateMatches). Null when the
  // row predates the field or the match simply has none — the hours-sum
  // escalation below only ever fires when BOTH sides of an overlap carry a
  // value; a null here keeps that overlap on the plain date-only wording.
  hoursPerWeek: number | null
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
// Two date ranges overlap, treating a missing end as still-ongoing (open-ended) rather than as no period at all.
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

// A standard full-time week — the threshold for Danny's hours-sum escalation.
export const FULL_TIME_HOURS_PER_WEEK = 40

/**
 * overlapHoursSum — Danny's hours-sum escalation on top of `findOverlappingMatches`.
 * When the drafted match's own hours AND the overlapping existing match's hours
 * are BOTH known, a combined week over `FULL_TIME_HOURS_PER_WEEK` is a real
 * double-booking risk, not just a date coincidence — the banner escalates its
 * wording. "Offered-iff-read": either side missing (older row without the
 * field, or the recruiter hasn't entered hours yet) returns null so the caller
 * keeps the calm, existing date-only note — never guess at a hidden overcommitment.
 */
export function overlapHoursSum(draftHours: number | null, rowHours: number | null): number | null {
  if (draftHours == null || rowHours == null) return null
  const sum = draftHours + rowHours
  return sum > FULL_TIME_HOURS_PER_WEEK ? sum : null
}
