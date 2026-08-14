/**
 * reportFilterParams — the ONE place that turns the reports right-panel's
 * filter state into the query params actually sent to a `/reports/*` endpoint.
 *
 * RAPPORT-FILTERS-1 (backend, 2026-08-14): the server ships one shared
 * `segmentQuery()` resolver that feeds BOTH a report and its drilldown, so the
 * same filter set can never describe two different things. Wired reports share
 * one vocabulary, identical to the entities' own list pages: `status[]`,
 * `owner_id[]`, `location_id[]`, and — on the two reports whose underlying table
 * actually carries a customer/client FK — `customer_id[]`
 * (`CUSTOMER_FILTERABLE_REPORT_IDS`). The remaining reports still only
 * understand `period` (+`from`/`to`/`bucket` set internally by each report's own
 * hook); sending them anything else would be silently ignored (or 422) server-side,
 * so this helper only ever attaches the extra dimensions for a report on
 * `FILTERABLE_REPORT_IDS`, and `customer_id` only for a report on
 * `CUSTOMER_FILTERABLE_REPORT_IDS` (AppliesReportFilters.php, verified per-report
 * 2026-08-14: vacancies filters on `client_id`, applications inherits it from the
 * vacancy — matches/tasks/candidates/customers have no such column wired for it).
 */
import type { ReportPeriod } from '@/types/analytics'

// The reports the backend resolver is wired to today (2026-08-14). Extend this
// set — and nothing else — the moment a report gains real filter support; every
// other id must stay period-only so no field appears that the server drops.
export const FILTERABLE_REPORT_IDS = ['candidates', 'customers', 'vacancies', 'applications', 'matches', 'tasks'] as const
export type FilterableReportId = (typeof FILTERABLE_REPORT_IDS)[number]

// Of the filterable reports, only these two accept `customer_id[]` too — see the
// file-top comment. Matches deliberately does NOT: its singular `customer_id`
// query key is already overloaded for a different, existing slice
// (MatchesReport::segmentQuery()'s own docblock) so an array-valued sibling
// would silently collide with it.
export const CUSTOMER_FILTERABLE_REPORT_IDS = ['vacancies', 'applications'] as const

export function isFilterableReport(reportId: string | undefined): reportId is FilterableReportId {
  return !!reportId && (FILTERABLE_REPORT_IDS as readonly string[]).includes(reportId)
}

function acceptsCustomerFilter(reportId: string | undefined): boolean {
  return !!reportId && (CUSTOMER_FILTERABLE_REPORT_IDS as readonly string[]).includes(reportId)
}

// Filter dimension state for a filterable report — same shape whether it feeds
// the report call or its drilldown, so the two can never diverge. `customerId`
// is only ever READ (and only ever sent) for a report on CUSTOMER_FILTERABLE_REPORT_IDS.
export interface ReportFilterState {
  status: Array<string | number>
  ownerId: Array<string | number>
  locationId: Array<string | number>
  customerId: Array<string | number>
}

export const EMPTY_REPORT_FILTERS: ReportFilterState = { status: [], ownerId: [], locationId: [], customerId: [] }

// Query params every report hook may safely spread into its `api.get(...)` call.
export interface ReportQueryParams {
  period: ReportPeriod
  status?: Array<string | number>
  owner_id?: Array<string | number>
  location_id?: Array<string | number>
  customer_id?: Array<string | number>
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
  if (filters.customerId.length && acceptsCustomerFilter(reportId)) params.customer_id = filters.customerId
  return params
}
