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

export interface VacanciesReportData {
  period: string
  from?: string
  to?: string
  summary: VacancyReportSummary
  vacancies: VacancyReportRow[]
}

// ── Matches report (GET /reports/matches) ────────────────────────────────────

export interface MatchesReportData {
  period: string
  from?: string
  to?: string
  total: number
  // funnel = from an application; direct = created without one.
  by_origin: { funnel: number; direct: number }
  // Match counts by HelloFlex contract status.
  placements: { sent: number; active: number; ended: number; total: number }
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

// ── Outreach report (GET /reports/outreach, REPORTS-2 fase 1) ────────────────
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors App\Services\Report\OutreachReport::run() exactly.

// One pipeline status tally. `status` is the tenant outreach-status slug — the
// endpoint carries no label alongside it, so the UI renders the slug as-is.
export interface OutreachStatusCount { status: string; count: number }

// One outcome tally, projected over the tenant's outreach_outcomes lookup
// (zero-count rows included). `share_of_reached` is null while nothing was reached.
export interface OutreachOutcomeCount { outcome: string; label: string; count: number; share_of_reached: number | null }

// GET /reports/outreach response. Windowed on `from`/`to` (defaults to the last 3
// months) — this endpoint has no `period` bucket, unlike the other reports.
export interface OutreachReportData {
  from: string
  to: string
  total_targets: number
  reached: number
  reach_rate: number | null
  by_status: OutreachStatusCount[]
  by_outcome: OutreachOutcomeCount[]
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
