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
import type { ReportId, RetiredReportRouteId } from './reportIds'

// Backend slugs the compare endpoint accepts today (ReportCompareController::REGISTRY).
export const COMPARE_SUPPORTED_SLUGS = [
  'flow', 'recruiters', 'vacancies', 'matches', 'outreach', 'sources',
  'candidates', 'leads', 'applications', 'customers', 'opportunities',
  'tasks', 'contacts', 'locations', 'departments', 'accountmanagers', 'ai', 'workflows',
] as const

export type CompareSlug = (typeof COMPARE_SUPPORTED_SLUGS)[number]

// Per report id (+ switch position), the backend slug to call — or null/absent
// when that position has no compare wiring. Positions not listed at all (e.g.
// 'intakes', which has no matching report-service registry entry) fall through
// to `getCompareSlug`'s default `null`.
// Retired route ids stay mapped only so the detached pages' own tests keep
// passing until the RAPPORTEN-DANNY10-1 cleanup round deletes them.
const COMPARE_SLUG_BY_REPORT_VIEW: Partial<Record<ReportId | RetiredReportRouteId, Partial<Record<string, CompareSlug>> | CompareSlug>> = {
  candidates: { candidates: 'candidates', leads: 'candidates' },
  applications: 'applications',
  customers: { customers: 'customers', prospects: 'customers' },
  // customerstructure switch positions map 1:1 onto three distinct backend slugs.
  customerstructure: { contacts: 'contacts', locations: 'locations', departments: 'departments' },
  flow: 'flow',
  // people switch: both positions wired (K-67 closed the accountmanagers gap).
  people: { recruiters: 'recruiters', accountmanagers: 'accountmanagers' },
  vacancies: 'vacancies',
  opportunities: 'opportunities',
  tasks: 'tasks',
  matches: 'matches',
  // 'intakes' has no matching entry in ReportCompareController::REGISTRY.
  outreach: 'outreach',
  usage: { ai: 'ai', workflows: 'workflows' },
}

/** Resolves the compare slug for a report id + optional switch position, or null when unsupported. */
export function getCompareSlug(reportId: ReportId | string, view?: string): CompareSlug | null {
  const entry = COMPARE_SLUG_BY_REPORT_VIEW[reportId as ReportId | RetiredReportRouteId]
  if (!entry) return null
  if (typeof entry === 'string') return entry
  return (view ? entry[view] : undefined) ?? null
}
