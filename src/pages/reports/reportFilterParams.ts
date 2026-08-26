/**
 * reportFilterParams — the ONE place that turns the reports right-panel's
 * filter state into the query params actually sent to a `/reports/*` endpoint.
 *
 * RAPPORT-FILTERS-1 (backend, 2026-08-14): the server ships one shared
 * `segmentQuery()` resolver that feeds BOTH a report and its drilldown, so the
 * same filter set can never describe two different things. Wired reports share
 * one vocabulary, identical to the entities' own list pages: `status[]`,
 * `owner_id[]`, `location_id[]`, and — on the reports whose underlying table
 * actually carries a customer/client FK — `customer_id[]`
 * (`CUSTOMER_FILTERABLE_REPORT_IDS`). The remaining reports still only
 * understand `period` (+`from`/`to`/`bucket` set internally by each report's own
 * hook); sending them anything else would be silently ignored (or 422) server-side,
 * so this helper only ever attaches the extra dimensions for a report on
 * `FILTERABLE_REPORT_IDS`, and `customer_id` only for a report on
 * `CUSTOMER_FILTERABLE_REPORT_IDS` (AppliesReportFilters.php, verified per-report
 * 2026-08-14: vacancies filters on `client_id`, applications inherits it from the
 * vacancy — matches/tasks/candidates/customers have no such column wired for it).
 *
 * WAVE 1c (2026-08-25): PLAN-RAPPORTEN-V3 §a landed a second, per-page batch of
 * combinable dimensions on the same shared `AppliesReportFilters` trait
 * (koiosmatch-api app/Services/Report/Concerns/AppliesReportFilters.php —
 * `extraDimensionRules()`), each consumed by exactly one report's own
 * segmentQuery(): candidates (`source[]`/`phase[]`/`contract_form[]`),
 * applications (`stage[]`/`source[]`/`vacancy_id[]`/`rejection_reason[]`),
 * matches (`customer_ids[]`/`origin[]`/`contract_form[]`/`stop_reason[]`), tasks
 * (`type[]`/`priority[]`/`team_id[]`), whatsapp (`direction[]`/`escalated`),
 * opportunities (`value_min`/`value_max`). Verified per-report in
 * app/Services/Report/{Candidates,Applications,Matches,Tasks,Whatsapp,Opportunities}Report.php
 * — a key only appears below for the report(s) whose segmentQuery() actually
 * reads it, so no field is ever sent where the server would silently ignore it.
 * `opportunities`/`outreach`/`whatsapp` join `FILTERABLE_REPORT_IDS` here too —
 * their status/owner/branch panel filters were already backend-wired
 * (ReportController.php reportFilterRules() calls) but never registered on the
 * FE panel until now. WHATSAPP-NARROW-1: whatsapp's own controller route drops
 * `status[]`/`location_id[]` from its rule set (`panelFilterRulesExcept(['location_id',
 * 'status'])`, ReportController.php — Conversation/Message carry neither column) —
 * `NO_STATUS_BRANCH_REPORT_IDS` mirrors that exclusion so the panel never shows a
 * dimension the server would 422 or silently drop.
 */
import type { ReportPeriod } from '@/types/analytics'

// The reports the backend resolver is wired to today. Extend this set — and
// nothing else — the moment a report gains real filter support; every other id
// must stay period-only so no field appears that the server drops.
export const FILTERABLE_REPORT_IDS = [
  'candidates', 'customers', 'vacancies', 'applications', 'matches', 'tasks',
  'opportunities', 'outreach', 'whatsapp',
] as const
export type FilterableReportId = (typeof FILTERABLE_REPORT_IDS)[number]

// Of the filterable reports, only these accept `customer_id[]` too — see the
// file-top comment. Matches deliberately does NOT: its singular `customer_id`
// query key is already overloaded for a different, existing slice
// (MatchesReport::segmentQuery()'s own docblock) so an array-valued sibling
// would silently collide with it — its own customer axis is the plural
// `customer_ids[]` below instead.
export const CUSTOMER_FILTERABLE_REPORT_IDS = ['vacancies', 'applications', 'opportunities'] as const

// WHATSAPP-NARROW-1: the one filterable report whose route drops status[]/
// location_id[] from its own rule set (ReportController.php panelFilterRulesExcept).
const NO_STATUS_BRANCH_REPORT_IDS = ['whatsapp'] as const

// True when the report's own segmentQuery() reads panel filters at all (also
// narrows the type to the FilterableReportId union for callers below).
export function isFilterableReport(reportId: string | undefined): reportId is FilterableReportId {
  return !!reportId && (FILTERABLE_REPORT_IDS as readonly string[]).includes(reportId)
}

// True only for the reports whose backing table carries a customer/client FK.
function acceptsCustomerFilter(reportId: string | undefined): boolean {
  return !!reportId && (CUSTOMER_FILTERABLE_REPORT_IDS as readonly string[]).includes(reportId)
}

// Whether a filterable report still accepts the base status[]/location_id[] pair
// (every filterable report except whatsapp — see NO_STATUS_BRANCH_REPORT_IDS).
export function acceptsStatusBranchFilter(reportId: string | undefined): boolean {
  return !!reportId && !(NO_STATUS_BRANCH_REPORT_IDS as readonly string[]).includes(reportId)
}

// Filter dimension state for a filterable report — same shape whether it feeds
// the report call or its drilldown, so the two can never diverge. Every field
// below is only ever READ (and only ever sent) for the report(s) its own
// segmentQuery() actually consumes — see the file-top WAVE 1c comment.
export interface ReportFilterState {
  status: Array<string | number>
  ownerId: Array<string | number>
  locationId: Array<string | number>
  customerId: Array<string | number>
  // WAVE 1c per-page dimensions — OPTIONAL (unlike the base four above): every
  // existing call site that builds a ReportFilterState literal by hand (mostly
  // tests) predates this wave and only ever sets the base four; making these
  // required would ripple a breaking type change into every one of those files.
  // `buildReportQueryParams` and ReportsPage.tsx both read them with `?? []`/
  // `?? null` so an omitted field behaves exactly like an explicit empty one.
  // Candidates: acquisition source (free-text names) + lifecycle phase + contract form.
  source?: Array<string | number>
  phase?: Array<string | number>
  contractForm?: Array<string | number>
  // Applications: funnel stage key + vacancy uuid (or 'none') + rejection reason uuid.
  stage?: Array<string | number>
  vacancyId?: Array<string | number>
  rejectionReason?: Array<string | number>
  // Tasks: task type/priority uuid (or 'none') + internal team uuid (or 'none').
  taskType?: Array<string | number>
  priority?: Array<string | number>
  teamId?: Array<string | number>
  // WhatsApp: message direction + escalation flag (single boolean, not an array).
  direction?: Array<string | number>
  escalated?: boolean | null
  // Matches: customer uuids (plural, distinct from the singular customerId) +
  // origin (funnel/direct) + termination stop reason.
  customerIds?: Array<string | number>
  origin?: Array<string | number>
  // Opportunities: pipeline value range — two independent optional bounds.
  valueMin?: number | null
  valueMax?: number | null
}

export const EMPTY_REPORT_FILTERS: ReportFilterState = {
  status: [], ownerId: [], locationId: [], customerId: [],
  source: [], phase: [], contractForm: [],
  stage: [], vacancyId: [], rejectionReason: [],
  taskType: [], priority: [], teamId: [],
  direction: [], escalated: null,
  customerIds: [], origin: [],
  valueMin: null, valueMax: null,
}

// Query params every report hook may safely spread into its `api.get(...)` call.
export interface ReportQueryParams {
  period: ReportPeriod
  status?: Array<string | number>
  owner_id?: Array<string | number>
  location_id?: Array<string | number>
  customer_id?: Array<string | number>
  source?: Array<string | number>
  phase?: Array<string | number>
  contract_form?: Array<string | number>
  stage?: Array<string | number>
  vacancy_id?: Array<string | number>
  rejection_reason?: Array<string | number>
  type?: Array<string | number>
  priority?: Array<string | number>
  team_id?: Array<string | number>
  direction?: Array<string | number>
  escalated?: boolean
  customer_ids?: Array<string | number>
  origin?: Array<string | number>
  value_min?: number
  value_max?: number
}

// Builds the query params for a report (or its drilldown) request. `reportId` +
// `filters` are optional so every existing period-only call site keeps working
// unchanged; only a call that passes a FILTERABLE report id and a non-empty
// dimension gets that param attached — everything else stays period-only. Each
// extra dimension is gated to the exact report(s) whose segmentQuery() reads it
// (see the file-top WAVE 1c comment) so no field ever reaches a report that
// would silently drop it.
export function buildReportQueryParams(
  period: ReportPeriod,
  reportId?: string,
  filters?: ReportFilterState,
): ReportQueryParams {
  const params: ReportQueryParams = { period }
  if (!isFilterableReport(reportId) || !filters) return params
  if (acceptsStatusBranchFilter(reportId)) {
    if (filters.status.length) params.status = filters.status
    if (filters.locationId.length) params.location_id = filters.locationId
  }
  if (filters.ownerId.length) params.owner_id = filters.ownerId
  if (filters.customerId.length && acceptsCustomerFilter(reportId)) params.customer_id = filters.customerId

  if (reportId === 'candidates') {
    if (filters.source?.length) params.source = filters.source
    if (filters.phase?.length) params.phase = filters.phase
    if (filters.contractForm?.length) params.contract_form = filters.contractForm
  }
  if (reportId === 'applications') {
    if (filters.stage?.length) params.stage = filters.stage
    if (filters.source?.length) params.source = filters.source
    if (filters.vacancyId?.length) params.vacancy_id = filters.vacancyId
    if (filters.rejectionReason?.length) params.rejection_reason = filters.rejectionReason
  }
  if (reportId === 'matches') {
    if (filters.customerIds?.length) params.customer_ids = filters.customerIds
    if (filters.origin?.length) params.origin = filters.origin
    if (filters.contractForm?.length) params.contract_form = filters.contractForm
  }
  if (reportId === 'tasks') {
    if (filters.taskType?.length) params.type = filters.taskType
    if (filters.priority?.length) params.priority = filters.priority
    if (filters.teamId?.length) params.team_id = filters.teamId
  }
  if (reportId === 'whatsapp') {
    if (filters.direction?.length) params.direction = filters.direction
    if (filters.escalated != null) params.escalated = filters.escalated
  }
  if (reportId === 'opportunities') {
    if (filters.valueMin != null) params.value_min = filters.valueMin
    if (filters.valueMax != null) params.value_max = filters.valueMax
  }
  return params
}
