/**
 * reportIds — the ordered list of analytical report sub-pages (RAPPORTEN-OMBOUW-1,
 * consolidated further in RAPPORTEN-CONSOLIDATIE-1 2026-08-14: Danny's sidebar
 * screenshot showed nineteen entries — "rapporten is nog steeds een veel te lange
 * lijst" — so five of those merged into ONE page each with a top-right switch,
 * mirroring the Shiftmanager dashboard's "In uren / In diensten" toggle).
 * One id per report; the first entry is the default report for a bare #reports hash.
 * Shared by the sidebar's Rapporten submenu and the ReportsPage router so the two
 * can never drift; ids double as the `reports.<id>` route keys and the
 * `analytics:tabs.<id>` label keys. Kept dependency-free on purpose: the sidebar
 * imports it without pulling the (lazy) report components into the main bundle.
 *
 * What merged into what (every merge is a SWITCH, never a lost page — see each
 * report component's own doc comment for the server-side filter that backs it):
 *   - 'leads' (own page)              → a Kandidaten/Leads switch on 'candidates'.
 *   - 'sources' (own page)            → retired: 'source' was already one of
 *     'candidates'/Instroom's own five axes, so its own page added nothing a
 *     switch position could isolate that the axis bar doesn't already show.
 *   - 'recruiters' + 'accountmanagers' → a switch on the new 'people' page.
 *   - 'contacts' + 'locations' + 'departments' → a switch on the new
 *     'customerstructure' page (kept SEPARATE from 'customers' — seeCustomersReport's
 *     switch is a same-entity population filter, contacts/locations/departments are
 *     three different entities entirely, so mixing them into one 5-way switch would
 *     have conflated two different kinds of "switching"; ReportsPage's doc comment
 *     has the full reasoning).
 *   - 'ai' + 'workflows'              → a switch on the new 'usage' page.
 * 'customers' itself also grew a Klanten/Prospects switch (no id merge — Prospects
 * never had its own route, this is new capability on an existing page).
 */
export const REPORT_IDS = [
  'candidates',
  'applications',
  'customers',
  // RAPPORTEN-CONSOLIDATIE-1: Contacts/Locations/Departments, three DIFFERENT
  // customer sub-entities, share one switch page — placed right after Klanten.
  'customerstructure',
  'flow',
  // RAPPORTEN-CONSOLIDATIE-1: Recruiters/Accountmanagers ("Mensen" — how are my
  // people doing, against a different entity each) share one switch page.
  'people',
  'vacancies',
  'opportunities',
  'tasks',
  'matches',
  'intakes',
  'outreach',
  // RAPPORTEN-CONSOLIDATIE-1: AI usage/Workflow runs ("Verbruik") share one switch page.
  'usage',
] as const

export type ReportId = (typeof REPORT_IDS)[number]

// A retired top-level route id → the merged page + switch position it now lands
// on. Every id that used to be its own `reports.<id>` route stays resolvable
// forever (house rule: a rename must never break a deep link) — appPages.tsx
// reads this map to render the merged ReportsPage with the right initial
// switch position instead of a 404/fallback. 'sources' has no position of its
// own (see the file-top comment) — it lands on Instroom's default Kandidaten
// view, where the Source axis it used to be a whole page for already lives.
export const LEGACY_REPORT_ROUTE_ALIASES: Record<string, { reportId: ReportId; view: string }> = {
  leads: { reportId: 'candidates', view: 'leads' },
  sources: { reportId: 'candidates', view: 'candidates' },
  recruiters: { reportId: 'people', view: 'recruiters' },
  accountmanagers: { reportId: 'people', view: 'accountmanagers' },
  contacts: { reportId: 'customerstructure', view: 'contacts' },
  locations: { reportId: 'customerstructure', view: 'locations' },
  departments: { reportId: 'customerstructure', view: 'departments' },
  ai: { reportId: 'usage', view: 'ai' },
  workflows: { reportId: 'usage', view: 'workflows' },
}
