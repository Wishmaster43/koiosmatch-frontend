/**
 * reportCompareSupport (RAPPORT-COMPARE-1 adoption) — the ONE map from a
 * frontend report id (+ optional switch-position `view`, RAPPORTEN-CONSOLIDATIE-1)
 * to the backend's `/reports/{slug}/compare` slug, or `null` when that position is
 * not wired yet. VERIFIED against the backend registry (ReportCompareController::
 * REGISTRY, koiosmatch-api, read 2026-08-17) — never assumed from a report existing
 * on the plain `/reports/*` list, since the compare endpoint is a DELIBERATE
 * subset (only reports with a time axis compare).
 *
 * A report/view absent here (or mapped to `null`) gets NO compare control — the
 * house rule is "the control simply is not there", never a disabled picker.
 */
import type { ReportId } from './reportIds'

// Backend slugs the compare endpoint accepts today (ReportCompareController::REGISTRY).
// RAPPORTEN-DANNY10-1: the retired reports' slugs left with the backend sweep
// (CMBE a52a6299) — only surviving reports compare.
export const COMPARE_SUPPORTED_SLUGS = [
  'vacancies', 'matches', 'outreach',
  'candidates', 'leads', 'applications', 'customers', 'opportunities', 'tasks',
] as const

export type CompareSlug = (typeof COMPARE_SUPPORTED_SLUGS)[number]

// Per report id (+ switch position), the backend slug to call — or null/absent
// when that position has no compare wiring. Positions not listed at all (e.g.
// 'intakes', which has no matching report-service registry entry) fall through
// to `getCompareSlug`'s default `null`.
// 'whatsapp' is deliberately absent: it is excluded from reports/{report}/compare
// server-side (no time-axis compare registry entry).
const COMPARE_SLUG_BY_REPORT_VIEW: Partial<Record<ReportId, Partial<Record<string, CompareSlug>> | CompareSlug>> = {
  candidates: { candidates: 'candidates', leads: 'candidates' },
  applications: 'applications',
  customers: { customers: 'customers', prospects: 'customers' },
  vacancies: 'vacancies',
  opportunities: 'opportunities',
  tasks: 'tasks',
  matches: 'matches',
  outreach: 'outreach',
}

/** Resolves the compare slug for a report id + optional switch position, or null when unsupported. */
export function getCompareSlug(reportId: ReportId | string, view?: string): CompareSlug | null {
  const entry = COMPARE_SLUG_BY_REPORT_VIEW[reportId as ReportId]
  if (!entry) return null
  if (typeof entry === 'string') return entry
  return (view ? entry[view] : undefined) ?? null
}
