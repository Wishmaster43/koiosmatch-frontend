/**
 * reportIds — the ordered list of analytical report sub-pages (RAPPORTEN-OMBOUW-1).
 * One id per report; the first entry is the default report for a bare #reports hash.
 * Shared by the sidebar's Rapporten submenu and the ReportsPage router so the two
 * can never drift; ids double as the `reports.<id>` route keys and the
 * `analytics:tabs.<id>` label keys. Kept dependency-free on purpose: the sidebar
 * imports it without pulling the (lazy) report components into the main bundle.
 */
export const REPORT_IDS = [
  'candidates',
  'applications',
  'customers',
  'flow',
  'recruiters',
  'vacancies',
  'opportunities',
  'tasks',
  'matches',
  'intakes',
  'outreach',
  'sources',
] as const

export type ReportId = (typeof REPORT_IDS)[number]
