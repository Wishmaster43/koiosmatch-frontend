/**
 * Analytics report types — the native `/reports/*` endpoints (flow · recruiters ·
 * later vacancies). These mirror the backend Resource shapes exactly; `phases[].key`
 * is the stable tenant funnel-stage key shared across flow + recruiters so one
 * colour/label map covers both reports.
 */

// One funnel stage in the flow report. `reached_count` = cohort (distinct
// applications that ever reached this stage → the real funnel); `current_count` =
// pipeline-now occupancy (the FE fallback while the cohort is still filling).
export interface FlowPhase {
  key: string
  label: string
  current_count: number
  reached_count: number
  conversion_rate: number | null
  avg_days_in_phase: number | null
}

// GET /reports/flow response.
export interface FlowReportData {
  period: string
  from?: string
  to?: string
  total: number
  phases: FlowPhase[]
}

// One stage tally for a recruiter (key matches FlowPhase.key — shared map).
export interface RecruiterPhaseCount { key: string; label: string; count: number }

// One recruiter row in the recruiters report.
export interface RecruiterRow {
  key: string
  label: string
  candidates: number
  intakes: { planned: number; done: number }
  applications_by_phase: RecruiterPhaseCount[]
  matches: number
  tasks: { open: number; overdue: number }
  not_contacted: number
}

// GET /reports/recruiters response.
export interface RecruitersReportData {
  period: string
  from?: string
  to?: string
  compliance_months: number
  recruiters: RecruiterRow[]
}

// ── Vacancies report (GET /reports/vacancies) ────────────────────────────────

// One vacancy row. `applications_by_phase[].key` shares the funnel key-map.
export interface VacancyReportRow {
  key: string
  label: string
  code?: string
  status: { value: string; label: string }
  customer: { id: string; name: string }
  applications: number
  applications_by_phase: RecruiterPhaseCount[]
  matched: number
  filled: boolean
  time_to_fill_days: number | null
}

// The summary tile row at the top of the vacancies report.
export interface VacancyReportSummary {
  total: number
  open: number
  filled: number
  fill_rate: number
  avg_time_to_fill_days: number | null
}

// Portie-4 additions are ADDITIVE (RAPPORTEN-SUITE-1): the C-34 envelope above
// (period/from/to/summary/vacancies) is unchanged; the new fields below are
// hand-written from the backend Service (the generated spec carries request
// shapes + 401 only, no 2xx schema — §10). Every by_* axis sums to `total`.
export interface VacanciesReportData {
  period: string
  from?: string
  to?: string
  summary: VacancyReportSummary
  vacancies: VacancyReportRow[]
  total: number
  // ?bucket=day|week overrides granularity; the default 3-month window buckets weekly.
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  // Zero-filled over the vacancy_statuses lookup (with color); orphan-uuid bars + 'none'.
  by_status: CandidateSegment[]
  // Top-10 + 'others' + 'none'; an archived customer keeps its real name.
  by_customer: ApplicationTopSegment[]
  // Top-10 + 'others' + 'none'; the raw function string is value AND label.
  by_function: ApplicationTopSegment[]
  // Zero-filled over the industries lookup on NAME strings; orphan names as own bars + 'none'.
  by_industry: CandidateSegment[]
  by_owner: CandidateOwnerSegment[]
  // VESTIGING-2: grouped via the CUSTOMER's mirrored branch, not any vacancy field.
  by_branch: CandidateSegment[]
}

// ── Matches report (GET /reports/matches) ────────────────────────────────────
// Portie-7 additions are ADDITIVE (RAPPORTEN-SUITE-1 slot): hand-written from the
// backend Service (the generated spec carries request shapes + 401 only, no 2xx
// schema — §10) — mirrors App\Services\Report\MatchesReport::run() for the fields
// the FE consumes; the envelope carries more (renewals/active/top_candidates/
// best_customers and extra terminations dimensions) not rendered yet.

// One termination stop-reason segment (portie 7): `value` mirrors the legacy `key`
// (SegmentBars parity), zero-filled over every active reason. The live drill XOR
// (origin|contract_form|contract_status|date) has no stop_reason param, so this
// axis renders WITHOUT a drill affordance.
export interface MatchTerminationReasonSegment { key: string; value: string; label: string; color: string | null; count: number }

// Match counts by HelloFlex contract status (MATCH-VOCABULAIRE-1 name). `total`
// counts matches UNDER CONTRACT — the report total minus the 'none' bucket.
// `none` explicit since 7925ce15; optional so a cached pre-update response still parses.
export interface MatchUnderContract { sent: number; active: number; ended: number; none?: number; total: number }

export interface MatchesReportData {
  period: string
  from: string
  to: string
  total: number
  // funnel = from an application; direct = created without one.
  by_origin: { funnel: number; direct: number }
  // Portie 7: the shared day/week timeseries over the same cohort. With week
  // buckets series[0].date is the MONDAY of the week containing `from` (a
  // pre-from Monday is the contract, not an error); day opens exactly on `from`.
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  // Soort-as (MATCH-SOORT-1): contract_form segments, sums to total. Includes a
  // 'none' sentinel for matches without a contract form, and any orphaned
  // (deleted-lookup) slug as its own segment — same shape/handling as the other
  // reports' segment axes (SegmentBars needs no special-casing for either).
  by_contract_form: CandidateSegment[]
  // The contract-status tile source — each tile drills contract_status=sent|
  // active|ended|none ('none' count = total - under_contract.total, exact since
  // contract_status is NOT NULL server-side).
  under_contract: MatchUnderContract
  // Legacy alias of under_contract's counts (ships one release for migration);
  // the FE reads under_contract.
  placements: { sent: number; active: number; ended: number; total: number }
  // Terminations slice (MATCH-REPORT-2): the FE renders total + by_reason.
  terminations: { total: number; by_reason: MatchTerminationReasonSegment[] }
  // Deliberately null until the HelloFlex coupling fills match start/end.
  avg_placement_duration_days: number | null
}

// ── Intakes report (GET /reports/intakes, C-22) ──────────────────────────────

// One bucket in the intake series or a breakdown dimension. `key` is null/’office’
// for the unassigned bucket; `count` = number of intake appointments.
export interface IntakeBucket { key: string | null; label: string; count: number }

// GET /reports/intakes response. `series` = intakes over time (the `bucket`
// granularity); the `by_*` arrays break the same total down per dimension.
export interface IntakesReportData {
  series: IntakeBucket[]
  by_recruiter: IntakeBucket[]
  by_location: IntakeBucket[]
  by_source: IntakeBucket[]
  by_function: IntakeBucket[]
  by_region: IntakeBucket[]
  total: number
}

// Selectable aggregation period (mirrors the endpoint's ?period=).
export type ReportPeriod = 'day' | 'week' | 'month'

// ── Outreach report (GET /reports/outreach, REPORTS-2 fase 1 + "portie 6") ───
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors App\Services\Report\OutreachReport::run() exactly. Portie 6 is
// ADDITIVE: the fase-1 fields (total_targets/reached/reach_rate + the legacy
// status/outcome keys) are unchanged; the new axes below sum to `total`.

// One pipeline status tally. Portie 6 added `value`/`label` ADDITIVELY next to
// the legacy `status` slug: `value` is the drill XOR param — an "Onbekend"
// orphan-string bar is a normal, drillable row.
export interface OutreachStatusCount { status: string; value: string; label: string; count: number }

// One outcome tally, projected over the tenant's outreach_outcomes lookup
// (zero-count rows included) + the "Geen uitkomst" sentinel so the axis sums to
// total. `value` (portie 6, additive next to the legacy `outcome`) is the drill
// XOR param; `share_of_reached` is null while nothing was reached.
export interface OutreachOutcomeCount { outcome: string; value: string; label: string; count: number; share_of_reached: number | null }

// GET /reports/outreach response. Windowed on `from`/`to` FROM THE RESPONSE;
// `period` echoes the sibling ?period= preset (null when none was sent).
export interface OutreachReportData {
  period: string | null
  from: string
  to: string
  total_targets: number
  reached: number
  reach_rate: number | null
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_status: OutreachStatusCount[]
  by_outcome: OutreachOutcomeCount[]
  // Top-20 + 'others' (the exact complement — a real, drillable row); an archived
  // campaign keeps its real name. Same {value,label,count} field shape as
  // ApplicationTopSegment; `value` accepts any uuid on the drill.
  by_campaign: ApplicationTopSegment[]
  // D2 shape; a NULL assignee arrives as the 'none' row ("Niet toegewezen").
  by_assignee: CandidateOwnerSegment[]
  // Zero-filled over the tenant channels + 'none'.
  by_channel: ApplicationTopSegment[]
}

// ── Candidates/leads inflow report (GET /reports/candidates, RAPPORTEN-SUITE-1) ─
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors the CONTRACT-CHANGELOG "portie 1" entry exactly.

// One axis segment: color/label come straight from the tenant lookup payload —
// never hardcoded (§4). `value` is the drill/advice XOR param.
export interface CandidateSegment { value: string; label: string; color: string | null; count: number }

// by_owner has its own D2 shape (owner_id/name), distinct from the other axes.
export interface CandidateOwnerSegment { owner_id: string; name: string; count: number }

// One point in the created_at timeseries; `date` is the machine key used for the
// date/bucket drill, `label` is the display string.
export interface CandidateTimeseriesPoint { date: string; label: string; value: number }

export interface CandidatesReportData {
  period: string
  from: string
  to: string
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_status: CandidateSegment[]
  by_phase: CandidateSegment[]
  by_source: CandidateSegment[]
  by_owner: CandidateOwnerSegment[]
  by_branch: CandidateSegment[]
}

// ── Applications report (GET /reports/applications, RAPPORTEN-SUITE-1 "portie 2") ─
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors the CONTRACT-CHANGELOG "portie 2" entry exactly.

// The funnel bucket tally — flag-driven, `placed` is EXACTLY the donut definition
// (cross-checked server-side against /applications/stats).
export interface ApplicationBucketCounts { active: number; matched: number; rejected: number; placed: number }

// A top-20 + 'others'-remainder segment (customer/vacancy axes). `value` doubles
// as the drill/advice XOR param — 'none' and 'others' are both real, clickable rows.
export interface ApplicationTopSegment { value: string; label: string; count: number }

export interface ApplicationsReportData {
  period: string
  from: string
  to: string
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_bucket: ApplicationBucketCounts
  by_stage: CandidateSegment[]
  by_source: CandidateSegment[]
  by_owner: CandidateOwnerSegment[]
  by_customer: ApplicationTopSegment[]
  by_vacancy: ApplicationTopSegment[]
}

// ── Customers report (GET /reports/customers, RAPPORTEN-SUITE-1 "portie 3") ──
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors the CONTRACT-CHANGELOG "portie 3" entry exactly. No by_source axis:
// customers have no `source` column (never invent one). by_industry segments carry
// no `color` (the Industry lookup has none) so `color` is always null there.
export interface CustomersReportData {
  period: string
  from: string
  to: string
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_status: CandidateSegment[]
  by_phase: CandidateSegment[]
  by_industry: CandidateSegment[]
  by_owner: CandidateOwnerSegment[]
  by_branch: CandidateSegment[]
}

// ── Opportunities report (GET /reports/opportunities, RAPPORTEN-SUITE-1 "portie 5") ─
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors App\Services\Report\OpportunitiesReport::run() exactly. The
// KANSEN-REPORT-1 envelope (period/totals/forecast/stale) kept its field shapes;
// portie 5 added total/timeseries/by_branch and normalised by_stage/by_customer
// with ADDITIVE value/label keys next to the legacy ones.

// One pipeline-stage segment. `value` mirrors the legacy `key` (SegmentBars
// normalisation) and is the drill/advice XOR param — 'none' and a raw orphan uuid
// (deleted stage, no FK on opportunity_stage_id) are both real, drillable rows.
// `value_sum` is money (euro), deliberately separate from `count`.
export interface OpportunityStageSegment {
  key: string
  value: string
  label: string
  color: string | null
  count: number
  value_sum: number
}

// One customer segment (top-20 + 'others' + 'none'). `value`/`label` mirror the
// legacy customer_id/name pair — `customer_id` is NOT always a uuid anymore
// ('none'/'others' are sentinels); a hard-deleted customer keeps its raw uuid
// with an "Onbekend" label and must stay drillable.
export interface OpportunityCustomerSegment {
  customer_id: string
  value: string
  name: string
  label: string
  count: number
  value_sum: number
}

// Pipeline-health tallies. `win_rate` counts DECIDED deals only and is null while
// nothing is decided (render a placeholder, never a fabricated 0%).
export interface OpportunityTotals {
  total: number
  open: number
  won: number
  lost: number
  win_rate: number | null
  open_value: number
  open_hours: number
  won_value: number
}

// Open deals per expected-close month — the report's only forward-looking slice.
export interface OpportunityForecastRow { month: string; count: number; value_sum: number }

export interface OpportunitiesReportData {
  // Unlike the sibling reports, the window lives NESTED under `period` here.
  period: { from: string; to: string }
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  totals: OpportunityTotals
  by_stage: OpportunityStageSegment[]
  by_owner: CandidateOwnerSegment[]
  by_customer: OpportunityCustomerSegment[]
  // Same {value,label,count} field shape as ApplicationTopSegment — here zero-filled
  // over the tenant locations + 'none' (direct FK column, so no orphan path).
  by_branch: ApplicationTopSegment[]
  forecast: OpportunityForecastRow[]
  stale: { untouched_days: number; untouched: number; overdue: number }
}

// ── Tasks report (GET /reports/tasks, RAPPORTEN-SUITE-1 "portie 6") ──────────
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors the CONTRACT-CHANGELOG "portie 6" entry exactly.

// One task-status segment. `value` is the status LOOKUP ID — never the slug
// (task_statuses.value is not uniqueness-protected); 'none' (NULL/'' folding) and
// a raw orphan uuid (deleted status) are both real, drillable rows. `is_done`
// mirrors the flag the summary counts on; `color` comes from the tenant lookup.
export interface TaskStatusSegment { value: string; label: string; color: string | null; is_done: boolean; count: number }

// Flag-driven tallies: done/overdue always count via the status `is_done` flag,
// never a slug. `done_rate` is null while nothing is countable (render a
// placeholder, never a fabricated 0%).
export interface TasksReportSummary { open: number; done: number; overdue: number; done_rate: number | null }

export interface TasksReportData {
  period: string
  from: string
  to: string
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  summary: TasksReportSummary
  by_status: TaskStatusSegment[]
  // Type/priority key on the lookup ID too (+ 'none'); same {value,label,count}
  // field shape as ApplicationTopSegment — no color on these axes.
  by_type: ApplicationTopSegment[]
  by_priority: ApplicationTopSegment[]
  // D2 shape; a NULL assignee arrives as the 'none' row ("Niet toegewezen").
  by_assignee: CandidateOwnerSegment[]
  by_team: ApplicationTopSegment[]
  by_branch: ApplicationTopSegment[]
}

// ── Sources report (GET /reports/sources, REPORTS-2 fase 2) ──────────────────
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors App\Services\Report\SourcesReport::run() exactly.

// One candidate source's intake cohort + yield. `match_rate` is null for a
// zero-candidate source (never divide by zero into a fabricated 0%).
export interface SourceRow {
  source: string
  candidates: number
  applications: number
  matches: number
  match_rate: number | null
}

// GET /reports/sources response. Windowed on `from`/`to` (defaults to the last 3
// months) — this endpoint has no `period` bucket either.
export interface SourcesReportData {
  from: string
  to: string
  sources: SourceRow[]
}

// ── Thin reports (RAPPORTEN-SUITE-2) ─────────────────────────────────────────
// Hand-written from the backend contract entry (the generated spec carries request
// shapes + 401 only, no 2xx schema — §10). All five follow the shared portie recipe:
// period echo + from/to + total + timeseries, axes of {value,label,count} that each
// sum to `total`, and (except AI) a drill/advice pair per bar.

// One axis bar, shared by the five thin reports.
export interface ThinSegment { value: string; label: string; count: number; color?: string | null }

// GET /reports/contacts — summary counts primary contacts and contact recency.
export interface ContactsReportData {
  period: string; from: string; to: string; total: number
  summary: { total: number; primary: number; with_recent_contact: number; never_contacted: number }
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_customer: ThinSegment[]; by_location: ThinSegment[]; by_department: ThinSegment[]
  by_function: ThinSegment[]; by_status: ThinSegment[]
}

// GET /reports/locations — `summary` splits locations with and without departments.
export interface LocationsReportData {
  period: string; from: string; to: string; total: number
  summary?: { with_departments: number; without_departments: number }
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_customer: ThinSegment[]; by_city: ThinSegment[]; by_province: ThinSegment[]; by_status: ThinSegment[]
}

// GET /reports/departments — `summary` splits departments with and without contacts.
export interface DepartmentsReportData {
  period: string; from: string; to: string; total: number
  summary?: { with_contacts: number; without_contacts: number }
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_customer: ThinSegment[]; by_location: ThinSegment[]; by_status: ThinSegment[]
}

// One AI usage bar: `value` is the RAW slug/model id (stable key), `label` the Dutch
// wording where the backend knows it and the raw value otherwise — never an empty bar.
// `amount` is a SALES figure only: the envelope carries no cost or margin, and the FE
// must never render or derive one (privacy line, RAPPORTEN-SUITE-2).
export interface AiActivitySegment { value: string; label: string; count: number
  color?: string | null; amount?: number | null; tokens?: number | null }

// GET /reports/ai — NO drill endpoint exists, so these bars stay non-clickable.
export interface AiReportData {
  period: string; from: string; to: string; total: number
  summary: { total: number; tokens: number; amount: number | null }
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_activity: AiActivitySegment[]; by_model: AiActivitySegment[]; by_user: AiActivitySegment[]
}

// GET /reports/workflows — run outcomes; `avg_duration_seconds` is null while nothing ran.
export interface WorkflowsReportData {
  period: string; from: string; to: string; total: number
  summary: {
    runs: number; completed: number; failed: number; cancelled: number; running: number
    success_rate: number | null; avg_duration_seconds: number | null
  }
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_workflow: ThinSegment[]; by_trigger: ThinSegment[]; by_status: ThinSegment[]
}
