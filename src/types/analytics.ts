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
  // Placement counts by HelloFlex contract status.
  placements: { sent: number; active: number; ended: number; total: number }
  // Deliberately null until the HelloFlex coupling fills placement start/end.
  avg_placement_duration_days: number | null
}

// Selectable aggregation period (mirrors the endpoint's ?period=).
export type ReportPeriod = 'day' | 'week' | 'month'
