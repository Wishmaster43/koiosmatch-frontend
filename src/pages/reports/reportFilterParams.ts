/**
 * reportFilterParams — the ONE place that turns the reports right-panel's
 * filter state into the query params actually sent to a `/reports/*`
 * endpoint. Today the server only understands `period` (and `from`/`to`/
 * `bucket` on a few reports, set internally by each report's own hook) — no
 * other filter dimension is server-side yet, so this helper deliberately
 * ignores anything else the sidebar might one day collect. When a report's
 * endpoint grows real filter support, wiring it becomes one extra line here
 * (and in the one report that needs it) instead of a param leaking out of
 * every report page ad hoc.
 */
import type { ReportPeriod } from '@/types/analytics'

// Query params every report hook may safely spread into its `api.get(...)` call.
export interface ReportQueryParams {
  period: ReportPeriod
}

// Builds the query params for a report request from the panel's current
// (still period-only) filter state. Kept as a function — not an inline
// object literal — so a second server-side filter lands as one added field
// here, read by every report hook that opts in, rather than a copy-pasted
// params object per report.
export function buildReportQueryParams(period: ReportPeriod): ReportQueryParams {
  return { period }
}
