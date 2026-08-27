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

// One stage tally for a recruiter (key matches FlowPhase.key — shared map).
export interface RecruiterPhaseCount { key: string; label: string; count: number }

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
  // SIGNALEN-VAC-1 (backend VacanciesReport::applySignal): the PDF-VACATURES point
  // 31 notification signal — published, zero applications, older than the tenant's
  // configurable stale-days setting (KoiosAdviceSettings). Real server-side count,
  // same predicate the drawer/list `?stale_online=1` filter and the row-level
  // vacancyAdvice.ts rule already use — never re-derived on the frontend.
  stale_online: number
  // Never published, older than the same shared threshold, not closed — the
  // "stuck in concept" companion signal (same backend predicate family).
  long_concept: number
  // An actively advertised, still-open vacancy with zero matches.
  no_matches: number
  // KPI-DREMPELS-FE-1: same predicate as stale_online, now carrying its own tenant
  // threshold (`vacancy_advice_stale_days`) so the report card needs no separate
  // settings lookup for its caption.
  advice_stale: number
  advice_stale_days: number
  // The vacancy's application_deadline falls within `closing_soon_days`
  // (`vacancy_closing_soon_days`) — open vacancies only. Drillable via its own
  // `closing_soon` boolean XOR key on the VacanciesDrillRequest/VacanciesAdviceRequest
  // whitelist (VAC-CLOSING-SOON-DRILL-1, mirrors stale_online) — never a `signal` param.
  closing_soon: number
  closing_soon_days: number
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
  // DASH-FEEDS-V3 depth (plumbing lane, additive) — optional: the compare
  // endpoint's diffed envelope does not carry these fields.
  // Median days per funnel step; null on an empty sample for that step.
  ttf_decomposition?: { published_to_first_application: number | null; first_application_to_proposal: number | null; proposal_to_match: number | null }
  // Top-20 OPEN vacancies of this report's window + panel filters ($base in
  // VacanciesReport::aging), oldest first; days_open counts from created_at.
  // recruiter: null without an owner, the server's own label when unresolved.
  // applications = the vacancy's full application count (drill population, kaartdrill-invariant);
  // recruiter_id = the owner's id for future linking (CMBE 0ecd0bf5); recruiter stays the display label.
  aging?: { id: string; title: string; days_open: number; recruiter: string | null; recruiter_id: string | null; candidates_in_process: number; applications: number }[]
  // Fixed 14-day window, tenant-wide (ignores this report's period). rate is PERCENT (0..100).
  fill_rate_timeseries?: { date: string; total: number; filled: number; rate: number | null }[]
  // House default window (3 months), by the vacancy's location_id. rate is PERCENT.
  fill_rate_by_branch?: { branch_id: string | null; branch: string; total: number; filled: number; rate: number | null }[]
  // KPI-VAC-1 (CMBE 28-08): the server's own nine-card kpis[] suite (mirrors
  // matches/opportunities/tasks) — optional: a cached pre-suite envelope omits
  // it, and the strip renders the house dash with no drill for a missing key.
  kpis?: { key: string; label?: string; count: number | null; unit?: 'pct' | 'ratio' | 'euro' | 'days' }[]
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
  // RAPPORT-KAARTDRILLS-2: the full KPI suite (GET /reports/matches/kpis/drill's
  // enum). Optional so a cached pre-update response still parses. Server sends a
  // `label` per card too — deliberately ignored (§5: labels come from i18n).
  kpis?: { key: string; label?: string; count: number | null; unit?: 'pct' | 'ratio' | 'euro' | 'days' }[]
}

// ── Intakes report (GET /reports/intakes, C-22) ──────────────────────────────

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
  // CMBE K-191 (commit 00e72f45): the envelope now carries the nine-card suite
  // in catalog order (total_targets/open_todo/called_in_period/reached/
  // not_reached/conversion_pct/campaigns_active/campaigns_done_in_period/
  // due_today) — counts identical to the flat fields, one predicate per card.
  kpis?: { key: string; label?: string; count: number | null; unit?: 'pct' | 'ratio' | 'euro' | 'days' }[]
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
  // DASH-FEEDS-V3 depth (plumbing lane, additive) — optional depth sections.
  // Per-channel funnel from targeted through placed, not windowed further than the report period.
  channel_funnel?: { channel: 'call' | 'email' | 'whatsapp' | 'none'; total: number; reached: number; applied: number; placed: number }[]
  // Top 5 campaigns, one daily count series each.
  campaign_timeseries?: { campaign_id: string; name: string; series: { date: string; count: number }[] }[]
  // Sparse: only cells with attempts>0. weekday is ISO (1=Mon); rate is PERCENT.
  best_contact_heatmap?: { weekday: number; part: 'ochtend' | 'middag' | 'avond'; attempts: number; reached: number; rate: number }[]
}

// ── WhatsApp report (GET /reports/whatsapp, RAPPORTEN-WHATSAPP-FE-1) ────────────
// Hand-written AGAINST THE LIVE BACKEND (CMBE f7a2c6f8; no 2xx schema in the
// generated spec yet, §10). Unlike outreach's flat envelope, whatsapp NESTS its
// window under `meta` — measured in WhatsappReport::run(), not assumed.
// `by_direction`/`by_type`/`by_escalated` are plain value/label/count segments.
export interface WhatsappSegment { value: string; label: string; count: number }

// One of the ten busiest threads in the period. Carries the candidate name
// (server-gated, PII-minimised) — NOT a wa_number: the masked number exists only
// in the per-KPI drill rows (§8/§9).
export interface WhatsappTopConversation {
  conversation_id: string | number
  candidate: string | null
  message_count: number
  last_message_at: string | null
}

export interface WhatsappReportData {
  meta: { period: string | null; from: string; to: string; total: number }
  // Server sends a `label` per card too — deliberately ignored (§5: labels come
  // from i18n, never server-composed).
  kpis: { key: string; label?: string; count: number | null; unit?: 'pct' | 'ratio' | 'euro' | 'days' }[]
  timeseries: { bucket: 'day' | 'week'; series: { date: string; inbound: number; outbound: number }[] }
  by_direction: WhatsappSegment[]
  by_type: WhatsappSegment[]
  by_escalated: WhatsappSegment[]
  // K-193 fase 0 (CMBE 7030fd6f): channel segments across the three channel
  // enum values, zero-filled — optional so an older envelope keeps rendering.
  by_channel?: WhatsappSegment[]
  top_conversations: WhatsappTopConversation[]
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

// FASE-DUUR-1: the pipeline-NOW occupancy per active funnel stage + its average
// days-in-phase (ApplicationsReport::stageDurationDistribution). `value` doubles as
// the `stage_duration` drill XOR param — the SAME stage-key vocabulary as `by_stage`,
// a different axis (longest-hanging rows, not just "in this stage").
// REPORT-FUNNEL-DIRECT-1 (BE 862508c3, def v1): `direct_entries` = applications
// that entered this stage DIRECTLY (created in it, from_stage_id null) rather
// than progressing out of an earlier stage — the honest explanation of a >100%
// funnel conversion. Optional: transition-tolerant while deploys cross.
export interface ApplicationStageSegment extends CandidateSegment { direct_entries?: number }

export interface ApplicationStageDurationSegment { value: string; label: string; count: number; avg_days_in_phase: number | null }

// RAPPORT-APPS-VERDIEPING-1 (CMFE 24-08): the nine-card KPI strip, now riding in
// THIS envelope (one-envelope migration — ApplicationKpisReport::kpis(), the
// sibling GET /reports/applications/kpis stays alive during the migration
// window). Server sends a `label` per card too — deliberately ignored (§5:
// labels come from i18n, mirrors WhatsappReportData). `count` is an integer row
// count for seven cards, a rounded float|null for conversion_pct/avg_days_to_match.
export interface ApplicationKpiCard { key: string; label?: string; count: number | null }

// INTAKE-IN-APPS-1 (Danny via CMFE 24-08): the intake-appointment numbers land
// HERE, not on a separate reports.intakes endpoint. Windowed on scheduled_at
// (is_intake-flagged appointment types), cancelled never counted.
// `by_recruiter` is the CandidateOwnerSegment shape (appointment owner_id/name);
// `by_branch` is the ApplicationTopSegment shape (value/label/count, 'none' = no vestiging).
export interface ApplicationIntakesBlock {
  planned: number
  done_in_period: number
  by_recruiter: CandidateOwnerSegment[]
  by_branch: ApplicationTopSegment[]
}

export interface ApplicationsReportData {
  period: string
  from: string
  to: string
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  by_bucket: ApplicationBucketCounts
  by_stage: ApplicationStageSegment[]
  by_source: CandidateSegment[]
  by_owner: CandidateOwnerSegment[]
  by_customer: ApplicationTopSegment[]
  by_vacancy: ApplicationTopSegment[]
  by_stage_duration: ApplicationStageDurationSegment[]
  kpis: ApplicationKpiCard[]
  intakes: ApplicationIntakesBlock
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
  // KD10 punt 21 (REPORTS-KPI-SPARE-2): nine STANDING signal counts over the whole
  // live customer base (contract ending, no contact, …) — CustomersReport::signalKpis(),
  // never windowed on created_at like the axes above. Previously typed nowhere on the
  // frontend even though the backend always sent it; now the source for the customers
  // scope's KPI-catalog spares (kpiCatalog.ts). Optional: the compare endpoint's diffed
  // envelope does not carry this array.
  kpis?: { key: string; label: string; count: number }[]
  // DASH-FEEDS-V3 depth (plumbing lane, additive) — optional depth sections; the
  // compare endpoint's diffed envelope does not carry these fields.
  // Top-5 concentration by placements/vacancies + a 6th 'others' row (customer_id null); shares are PERCENT.
  concentration_top5?: { by_placements: ConcentrationRow[]; by_vacancies: ConcentrationRow[]; top5_share_placements_pct: number | null; top5_share_vacancies_pct: number | null }
  // 12 trailing months. rate is a RATIO 0..1 (not percent) — multiply by 100 before formatPercent.
  phase_cohorts?: { cohort: string; prospects: number; converted: number; rate: number | null }[]
  // 12 trailing months, fixed window (ignores this report's period).
  churn_trend?: { month: string; churned: number }[]
  // 6 trailing months, fixed window (ignores this report's period).
  by_owner_x_period?: { owner_id: string | null; name: string; months: { month: string; count: number }[] }[]
}

// One concentration row (≤5 + a synthetic 'others' row with customer_id null).
export interface ConcentrationRow { customer_id: string | null; name: string; count: number; pct: number }

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
  // KPI-DREMPELS-FE-1 (additive, distinct from the older top-level `stale` object
  // below): an open deal with no stage change since `stage_changed_at` for at least
  // `stale_days` (`opportunity_stale_days`) counts as stale; one nearing its
  // `expected_close_at` within `closing_soon_days` (`opportunity_closing_soon_days`)
  // counts as closing soon. Closed deals never count in either.
  stale: number
  stale_days: number
  closing_soon: number
  closing_soon_days: number
}

// Open deals per expected-close month — the report's only forward-looking slice.
export interface OpportunityForecastRow { month: string; count: number; value_sum: number }

export interface OpportunitiesReportData {
  // Unlike the sibling reports, the window lives NESTED under `period` here.
  period: { from: string; to: string }
  total: number
  timeseries: { bucket: 'day' | 'week'; series: CandidateTimeseriesPoint[] }
  // KPI-OPP-1 (CMBE 27-08, commit eb3af985): the nine-card suite in catalog
  // order (total/open/won/lost/win_rate/open_value/stale/closing_soon/overdue) —
  // mirrors matches/tasks/outreach's kpis[] idiom (KPI-MATCHES-1).
  kpis?: { key: string; label?: string; count: number | null; unit?: 'pct' | 'ratio' | 'euro' | 'days' }[]
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
  // RAPPORT-KAARTDRILLS-2: the full KPI suite (GET /reports/tasks/kpis/drill's
  // enum). Optional so a cached pre-update response still parses. Server sends a
  // `label` per card too — deliberately ignored (§5: labels come from i18n).
  kpis?: { key: string; label?: string; count: number | null; unit?: 'pct' | 'ratio' | 'euro' | 'days' }[]
}

// ── Sources report (GET /reports/sources, REPORTS-2 fase 2) ──────────────────
// Hand-written from the backend Service (no 2xx schema in the generated spec yet,
// §10) — mirrors App\Services\Report\SourcesReport::run() exactly.

// ── Thin reports (RAPPORTEN-SUITE-2) ─────────────────────────────────────────
// Hand-written from the backend contract entry (the generated spec carries request
// shapes + 401 only, no 2xx schema — §10). All five follow the shared portie recipe:
// period echo + from/to + total + timeseries, axes of {value,label,count} that each
// sum to `total`, and (except AI) a drill/advice pair per bar.

// One axis bar, shared by the five thin reports.
export interface ThinSegment { value: string; label: string; count: number; color?: string | null }

