/**
 * smCandidateFields — tolerant field readers for the ShiftManager candidate row
 * (§10: the backend is snake_case; guard an unexpected camelCase mirror too so a
 * rename never silently blanks a column/KPI). Shared by SmCandidatesInsightsRow
 * (ending-soon KPI) and SmCandidatesTable (Uitschrijfdatum column) — one source
 * for reading these fields instead of two copies drifting apart.
 */
import type { ReportCandidate } from '@/types/reports'

// The end-of-employment date ("Uitschrijfdatum") — snake_case from the API, with a
// camelCase fallback guard.
export const endDateOf = (c: ReportCandidate): string | undefined =>
  (c.end_date_employment as string | undefined) ?? (c.endDateEmployment as string | undefined)

// No-show count — the API exposes `no_show_count`; `no_shows` is an older alias.
export const noShowCountOf = (c: ReportCandidate): number =>
  Number(c.no_show_count ?? c.no_shows ?? 0)

// Cancellation count.
export const cancellationsOf = (c: ReportCandidate): number =>
  Number(c.cancellations ?? 0)

/** Tolerant feature-name reader ("kenmerken"): array of {name}/strings → names. */
export const featureNamesOf = (c: ReportCandidate): string[] =>
  Array.isArray(c.features)
    ? c.features.map(f => (typeof f === 'string' ? f : (f as { name?: string })?.name)).filter((x): x is string => Boolean(x))
    : []

/** Registration YEAR of a row, or null when the date is absent/unparsable. */
export const registrationYearOf = (c: ReportCandidate): number | null => {
  const y = c.registration_date ? new Date(c.registration_date).getFullYear() : NaN
  return Number.isFinite(y) ? y : null
}
