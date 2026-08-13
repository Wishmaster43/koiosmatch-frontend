/**
 * reportDrillGate — the single capability flag for the report drill-down affordance.
 * The six `/reports/<name>/drill` + `/reports/<name>/advice` endpoints do NOT exist server-side
 * (verified 2026-08-13) — until backend-Claude ships that contract (see
 * koiosmatch-api/docs/WORKLIST.md), every report must render its KPI cards/bars/rows
 * WITHOUT a click affordance instead of shipping a control that 404s. Flip this one
 * flag once the contract lands; every report reads it, so there is nothing left to
 * flip per screen. Tests override it via `vi.mock('./reportDrillGate', ...)`.
 */
export const REPORT_DRILL_AVAILABLE = false

// Gates a drill-down click handler behind the capability flag: while unavailable this
// returns `undefined` so the caller (InsightsRow's KpiCard, DataTable's onRowClick, a
// hand-rolled funnel bar) drops the pointer cursor, the onClick and the button role —
// never a clickable surface with nowhere real to go.
export function gateDrillClick<T extends (...args: never[]) => void>(handler: T): T | undefined {
  return REPORT_DRILL_AVAILABLE ? handler : undefined
}
