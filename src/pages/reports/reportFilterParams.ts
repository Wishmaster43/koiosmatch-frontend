/**
 * reportFilterParams — the ONE place that turns the reports right-panel's
 * filter state into the query params actually sent to a `/reports/*` endpoint.
 *
 * RAPPORT-FILTERS-1 (backend, 2026-08-14): the server ships one shared
 * `segmentQuery()` resolver that feeds BOTH a report and its drilldown, so the
 * same filter set can never describe two different things. It is wired to
 * exactly two reports so far — `candidates` and `customers` — with a vocabulary
 * identical to those entities' own list pages: `status[]`, `owner_id[]`,
 * `location_id[]`. The other twelve reports still only understand `period`
 * (+`from`/`to`/`bucket` set internally by each report's own hook); sending them
 * anything else would be silently ignored server-side, so this helper only ever
 * attaches the extra dimensions for a report on `FILTERABLE_REPORT_IDS`.
 */
import type { ReportPeriod } from '@/types/analytics'

// The two reports the backend resolver is wired to today (2026-08-14). Extend
// this set — and nothing else — the moment a report gains real filter support;
// every other id must stay period-only so no field appears that the server drops.
export const FILTERABLE_REPORT_IDS = ['candidates', 'customers'] as const
export type FilterableReportId = (typeof FILTERABLE_REPORT_IDS)[number]

export function isFilterableReport(reportId: string | undefined): reportId is FilterableReportId {
  return !!reportId && (FILTERABLE_REPORT_IDS as readonly string[]).includes(reportId)
}

// Filter dimension state for a filterable report — same shape whether it feeds
// the report call or its drilldown, so the two can never diverge.
export interface ReportFilterState {
  status: Array<string | number>
  ownerId: Array<string | number>
  locationId: Array<string | number>
}

export const EMPTY_REPORT_FILTERS: ReportFilterState = { status: [], ownerId: [], locationId: [] }

// Query params every report hook may safely spread into its `api.get(...)` call.
export interface ReportQueryParams {
  period: ReportPeriod
  status?: Array<string | number>
  owner_id?: Array<string | number>
  location_id?: Array<string | number>
}

// Builds the query params for a report (or its drilldown) request. `reportId` +
// `filters` are optional so every existing period-only call site keeps working
// unchanged; only a call that passes a FILTERABLE report id and a non-empty
// dimension gets that param attached — everything else stays period-only.
export function buildReportQueryParams(
  period: ReportPeriod,
  reportId?: string,
  filters?: ReportFilterState,
): ReportQueryParams {
  const params: ReportQueryParams = { period }
  if (!isFilterableReport(reportId) || !filters) return params
  if (filters.status.length) params.status = filters.status
  if (filters.ownerId.length) params.owner_id = filters.ownerId
  if (filters.locationId.length) params.location_id = filters.locationId
  return params
}
