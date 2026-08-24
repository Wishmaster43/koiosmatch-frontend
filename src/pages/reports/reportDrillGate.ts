/**
 * reportDrillGate — the per-report-set capability flag for the report drill-down
 * affordance. REPORTS-DRILL-1 (verified live 2026-08-13, see
 * koiosmatch-api/docs/CONTRACT-CHANGELOG.md) shipped `GET /reports/{r}/drill|advice`
 * for **flow · matches · recruiters · vacancies** — intakes has no matching
 * backend endpoint yet, so it stays gated off until its own contract lands.
 * RAPPORTEN-SUITE-1 (2026-08-14, "portie 1") added the same pair for
 * **candidates** (six-way XOR: status|phase|source|owner|branch|date). "Portie 2"
 * (2026-08-14) added the same pair for **applications** (six-way XOR: stage|bucket|
 * source|owner|customer|vacancy|date — bucket carries a dual role, see
 * ApplicationsReport). "Portie 3" (2026-08-14) added the same pair for
 * **customers** (five-way XOR: status|phase|industry|owner|branch|date — no
 * by_source, customers have no source column). "Portie 5" (2026-08-14) added the
 * same pair for **opportunities** (five-way XOR: stage|customer|owner|branch|date).
 * "Portie 6" (2026-08-14) added the same pair for **tasks** (seven-way XOR:
 * status|type|priority|assignee|team|branch|date — status/type/priority key on
 * the lookup ID, never the slug).
 * REPORTS-DRILL-2 (2026-08-15): **intakes** verified live against the real
 * controller (`GET /reports/intakes/drill`, ReportDrillController::intakes —
 * candidates.view gate, at most one of recruiter|location|source|function|region)
 * — flipped from false to true now the route genuinely accepts and answers it
 * (was previously reported landed while the route 422'd; re-verified this time
 * against the controller's validation rules, not just the route list). The
 * outreach upgrade ("portie 6", 2026-08-14)
 * flipped the last fase-1 report to the same pair (six-way XOR: campaign|assignee|
 * channel|status|outcome|date — campaign accepts any uuid AND 'others' for the
 * exact top-20 complement; rows carry candidate names, so the drill sits behind
 * the outreach.view data permission with the calm 403 degrade). Every report
 * reads its own key here; there is nothing left to flip per screen once a
 * report's endpoint exists.
 * Tests override via `vi.mock('./reportDrillGate', ...)`.
 *
 * RAPPORTEN-CONSOLIDATIE-1 (2026-08-14): 'sources' retired — the standalone
 * Sources page folded into Instroom's pre-existing Source axis (reportIds.ts),
 * so there is no longer any caller passing 'sources' here; removed rather than
 * left as dead vocabulary.
 */
export type DrillableReport = 'matches' | 'vacancies' | 'outreach' | 'whatsapp' | 'candidates' | 'applications' | 'customers' | 'opportunities' | 'tasks'

export const REPORT_DRILL_AVAILABLE: Record<DrillableReport, boolean> = {
  matches: true,
  vacancies: true,
  candidates: true,
  applications: true,
  customers: true,
  opportunities: true,
  tasks: true,
  outreach: true,
  // RAPPORTEN-WHATSAPP-FE-1: whatsapp's ONE drill is per KPI CARD —
  // GET /reports/whatsapp/kpis/drill?kpi=<key> (ReportDrillController::whatsappKpi,
  // registered live in CMBE f7a2c6f8 and measured against the route file by the
  // Opus review). There is NO axis/bucket drill and NO advice route; rows carry
  // masked wa_numbers only (§8/§9), gated behind module:whatsapp.
  whatsapp: true,
}

// Gates a drill-down click handler behind the per-report capability flag: while a
// report's endpoint is unavailable this returns `undefined` so the caller (InsightsRow's
// KpiCard, DataTable's onRowClick, a hand-rolled funnel bar) drops the pointer cursor,
// the onClick and the button role — never a clickable surface with nowhere real to go.
export function gateDrillClick<T extends (...args: never[]) => void>(report: DrillableReport, handler: T): T | undefined {
  return REPORT_DRILL_AVAILABLE[report] ? handler : undefined
}
