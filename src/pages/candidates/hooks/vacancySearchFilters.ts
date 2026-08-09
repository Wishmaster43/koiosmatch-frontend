/**
 * vacancySearchFilters — the PURE seed + filter rules behind useVacancySearch
 * (candidate → vacancy Match-zoeker). Split out of the hook so the stateful part
 * stays readable and every rule here is testable on its own (§3 size discipline).
 * Nothing in this module touches React, the API or i18n.
 */
import type { Criterion } from '@/components/match/MatchScoreBlock'
import type { Candidate } from '@/types/candidate'
import type { Id } from '@/types/common'

export interface VacancySearchRow {
  id: Id
  title: string
  customer: string
  city: string
  status: string
  functionTitle: string
  lat: number | null
  lng: number | null
  distanceKm: number | null
  score: number | null
  criteria: Criterion[]
  aiAdvised: boolean
  aiAdviceReason: string | null
  // Contract-form LABEL as returned by the vacancy ("ZZP"/"Oproep"/"Tijdelijk"/…) —
  // already tenant-configured text, not a slug (MatchExplorerService::vacancyShape).
  employmentType: string | null
  // Weekly-hours range + start date (measured live 09-08: the match payload's
  // vacancy object carries hours_min/hours_max/start_date) — null when the vacancy
  // itself left them empty, which the "never exclude" filter rules below respect.
  hoursMin: number | null
  hoursMax: number | null
  startDate: string | null
}

/**
 * Slider domain for the "Uren per week" filter: 0..40 (a Dutch full-time week).
 * A handle parked at a domain END means "unbounded on that side", so a vacancy
 * outside 0..40 is never excluded by a bound the recruiter never actually narrowed.
 */
export const HOURS_RANGE_MAX = 40

/** Weekly-hours filter as the range slider carries it: [lower, upper]. */
export type HoursRange = [number, number]

// Per-candidate travel preference (Danny 23-07): the radius default follows the
// candidate's OWN `preferences.max_travel_km`, falling back to a calm 30km when
// that isn't set (or isn't a usable positive number).
export function defaultRadiusKm(candidate: Candidate): number {
  const pref = Number((candidate.preferences as { max_travel_km?: unknown } | undefined)?.max_travel_km)
  return Number.isFinite(pref) && pref > 0 ? pref : 30
}

// Seed the "Uren per week" range from the candidate's own hours preference: it
// becomes the LOWER bound (clamped into the slider domain); the upper bound starts
// parked at the domain end, i.e. open.
export function defaultHoursRange(candidate: Candidate): HoursRange {
  const pref = Number((candidate.preferences as { hours_per_week?: unknown } | undefined)?.hours_per_week)
  const lower = Number.isFinite(pref) && pref > 0 ? Math.min(Math.round(pref), HOURS_RANGE_MAX) : 0
  return [lower, HOURS_RANGE_MAX]
}

// Seed the "Inzetbaar vanaf" filter from the candidate's own available-from date.
// Sliced to the date-only part — the preference may carry a full timestamp.
export function defaultAvailableFrom(candidate: Candidate): string {
  const pref = (candidate.preferences as { available_from?: unknown } | undefined)?.available_from
  return typeof pref === 'string' && pref ? pref.slice(0, 10) : ''
}

// Range-overlap test for the "Uren per week" filter — a vacancy carrying NEITHER
// hours_min NOR hours_max is never excluded (no data to filter on), and a handle at
// a domain end drops that side's bound entirely (see HOURS_RANGE_MAX).
export function hoursOverlap(row: VacancySearchRow, [lower, upper]: HoursRange): boolean {
  if (row.hoursMin == null && row.hoursMax == null) return true
  const vMin = row.hoursMin ?? -Infinity
  const vMax = row.hoursMax ?? Infinity
  const fMin = lower <= 0 ? -Infinity : lower
  const fMax = upper >= HOURS_RANGE_MAX ? Infinity : upper
  return vMin <= fMax && fMin <= vMax
}

// "Inzetbaar vanaf" filter: keep vacancies whose start_date is on/after the chosen
// date. A vacancy without its own start_date is never excluded (no data to filter
// on); date-only string comparison is safe since both sides are ISO 'YYYY-MM-DD'.
export function afterAvailableFrom(row: VacancySearchRow, chosen: string): boolean {
  if (!chosen || !row.startDate) return true
  return row.startDate.slice(0, 10) >= chosen
}

/**
 * Contract-form filter — a vacancy that carries NO contract form is never excluded.
 *
 * This is the same "no data to filter on" rule hoursOverlap and afterAvailableFrom
 * already follow, and this filter was the one that broke it. Measured 09-08 on
 * Danny's own candidate: the server returned 9 matches, every one of them with
 * employment_type null, while the filter had auto-seeded the candidate's own three
 * contract forms — so `''` matched none of them and the screen said "geen vacatures
 * gevonden binnen deze filters" while the API had just answered with nine.
 *
 * Excluding a row for a value the row does not have is never right: it hides real
 * results and blames the recruiter's filters for missing data.
 */
export function matchesContractForm(row: VacancySearchRow, contractvorm: string[]): boolean {
  if (contractvorm.length === 0) return true
  if (!row.employmentType) return true
  return contractvorm.includes(row.employmentType)
}

// Client-side filters over the ALREADY-FETCHED rows (Danny 06-08 "eerst de extra
// filters") — the set is already radius/status/function bounded by the server; these
// three narrow it further without a second network round-trip.
export function applyClientFilters(
  rows: VacancySearchRow[],
  contractvorm: string[],
  hoursRange: HoursRange,
  availableFrom: string,
): VacancySearchRow[] {
  return rows.filter(r =>
    matchesContractForm(r, contractvorm) &&
    hoursOverlap(r, hoursRange) &&
    afterAvailableFrom(r, availableFrom),
  )
}

// Ghost-filter fix (Danny 05-08): the candidate's own `title` (e.g. "Verpleegkundige")
// often has NO exact match in the tenant's /functions lookup (which may only carry
// "Verpleegkundige N4"/"N5") — seeding that raw title selected a value the SearchSelect
// can render no check for AND the API can't match on (zero results, no visible cause).
// Match EXACT + case-insensitive only — never a prefix expansion (a scope-of-practice
// title must never auto-select a DIFFERENT function, e.g. Verzorgende-anything) — and
// return the option's OWN casing so the stored value lines up with what renders.
export function matchFunctionOption(title: string | null | undefined, options: string[]): string | null {
  const needle = (title ?? '').trim().toLowerCase()
  if (!needle) return null
  return options.find(o => o.toLowerCase() === needle) ?? null
}

// Order-insensitive equality for the multi-select filter values — a user toggling a
// value off and back on must not count as "changed" for the reset button below.
export function sameValues(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((v, i) => v === sortedB[i])
}
