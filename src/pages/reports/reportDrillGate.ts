/**
 * reportDrillGate — the per-report-set capability flag for the report drill-down
 * affordance. REPORTS-DRILL-1 (verified live 2026-08-13, see
 * koiosmatch-api/docs/CONTRACT-CHANGELOG.md) shipped `GET /reports/{r}/drill|advice`
 * for **flow · matches · recruiters · vacancies** only — intakes/outreach/sources have
 * no matching backend endpoint yet, so those three stay gated off until their own
 * contract lands. Every report reads its own key here; there is nothing left to flip
 * per screen once a report's endpoint exists. Tests override via
 * `vi.mock('./reportDrillGate', ...)`.
 */
export type DrillableReport = 'flow' | 'matches' | 'recruiters' | 'vacancies' | 'intakes' | 'outreach' | 'sources'

export const REPORT_DRILL_AVAILABLE: Record<DrillableReport, boolean> = {
  flow: true,
  matches: true,
  recruiters: true,
  vacancies: true,
  // Not shipped yet — no /reports/{r}/drill|advice endpoint on the backend.
  intakes: false,
  outreach: false,
  sources: false,
}

// Gates a drill-down click handler behind the per-report capability flag: while a
// report's endpoint is unavailable this returns `undefined` so the caller (InsightsRow's
// KpiCard, DataTable's onRowClick, a hand-rolled funnel bar) drops the pointer cursor,
// the onClick and the button role — never a clickable surface with nowhere real to go.
export function gateDrillClick<T extends (...args: never[]) => void>(report: DrillableReport, handler: T): T | undefined {
  return REPORT_DRILL_AVAILABLE[report] ? handler : undefined
}
