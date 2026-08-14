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
  // REPORTS-LEADS-1 (2026-08-14): leads-only slice of the candidate inflow,
  // placed right after candidates to mirror the order Danny asked for.
  'leads',
  'applications',
  'customers',
  'flow',
  'recruiters',
  // REPORTS-ACCTMGR-1 (2026-08-14): per-account-manager customer ownership,
  // placed right after recruiters to mirror the order Danny asked for.
  'accountmanagers',
  'vacancies',
  'opportunities',
  'tasks',
  'matches',
  'intakes',
  'outreach',
  'sources',
  // RAPPORTEN-SUITE-2 (contacts/locations/departments read customers.view; ai and
  // workflows additionally sit behind their own module — see access.ts).
  'contacts',
  'locations',
  'departments',
  'ai',
  'workflows',
] as const

export type ReportId = (typeof REPORT_IDS)[number]
