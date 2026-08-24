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
// RAPPORTEN-DANNY10-1 (Danny 24-08, via CMBE-afstemming: exactly ten report
// pages — hub + candidates/applications/customers/vacancies/opportunities/
// tasks/matches/outreach/whatsapp — "DE REST MOET WEG"). The retired route ids
// (customerstructure/flow/people/usage/intakes + their legacy aliases) resolve
// to the hub root via appPages' stale-reports fallback, never a dead screen.
// Danny 24-08 settled intakes: no own report page ("#reports.intakes hebben we
// niet") — its numbers land as KPI's inside the applications report (CMBE);
// 'whatsapp' joins once its backend contract is registered.
export const REPORT_IDS = [
  'candidates',
  'applications',
  'customers',
  'vacancies',
  'opportunities',
  'tasks',
  'matches',
  'outreach',
  'whatsapp',
] as const

export type ReportId = (typeof REPORT_IDS)[number]

// RAPPORTEN-DANNY10-1: route ids retired by Danny's ten-page decision. Their
// PAGES still exist on disk pending the explicit file-cleanup round (they are
// unreachable — no route, no sidebar entry, no hub tile) and keep compiling
// through this type; the cleanup round removes the files and this alias.
export type RetiredReportRouteId = 'customerstructure' | 'flow' | 'people' | 'usage' | 'intakes'

// A retired top-level route id → the merged page + switch position it now lands
// on. Every id that used to be its own `reports.<id>` route stays resolvable
// forever (house rule: a rename must never break a deep link) — appPages.tsx
// reads this map to render the merged ReportsPage with the right initial
// switch position instead of a 404/fallback. 'sources' has no position of its
// own (see the file-top comment) — it lands on Instroom's default Kandidaten
// view, where the Source axis it used to be a whole page for already lives.
// RAPPORTEN-DANNY10-1: aliases whose merged host page retired with Danny's
// ten-page decision (recruiters/accountmanagers/contacts/locations/departments/
// ai/workflows) fell out of this map — those deep links now resolve through
// appPages' stale-reports fallback to the hub root instead.
export const LEGACY_REPORT_ROUTE_ALIASES: Record<string, { reportId: ReportId; view: string }> = {
  leads: { reportId: 'candidates', view: 'leads' },
  sources: { reportId: 'candidates', view: 'candidates' },
}
