/**
 * Dashboard types. The dashboard maps several loosely-typed backend payloads
 * (/candidates/stats, /opportunities/stats, /dashboard); these declare the
 * fields the cards/lists/charts read. Index signatures keep them tolerant of
 * extra backend fields.
 */

// A distribution/aggregate item (by_status / by_owner / by_funnel / by_stage).
export interface StatItem {
  value?: string
  status?: string
  key?: string
  label?: string
  color?: string
  count?: number
  name?: string
  id?: string | number
  owner_id?: string | number
  [k: string]: unknown
}

// /candidates/stats
export interface DashStats {
  by_status?: StatItem[]
  by_owner?: StatItem[]
  [k: string]: unknown
}

// /opportunities/stats
export interface DashOpp {
  by_stage?: StatItem[]
  // Hours-mode pipeline sum (tenant setting) — not (yet) a pinned dash.kpis key;
  // the euro pipeline KPI reads dash.kpis.pipeline_value (K-168).
  pipeline_hours?: number | null
  [k: string]: unknown
}

// KD11 (DASHP36) widget feeds — sales/account-manager dashboard templates.
// Present only for the matching view-permission; absent entirely (not `[]`)
// means the block is not shown for this role, mirroring the attention keys.
export interface ExpiringMatch { id?: string | number; candidate_id?: string | number; candidate_name?: string | null; customer_id?: string | number; customer_name?: string; end_date?: string; [k: string]: unknown }
export interface StaleVacancy { id?: string | number; title?: string; published_at?: string; [k: string]: unknown }
export interface KoiosSuggestion { vacancy_id?: string | number; vacancy_title?: string; suggestions_count?: number; [k: string]: unknown }
// sales_manager only — the tenant-wide "where does business come from" breakdown.
export interface CustomerByOwner { owner_id?: string | number; name?: string; count?: number; [k: string]: unknown }

export interface RecentCandidate { name?: string; status_value?: string; role?: string; last_activity_at?: string; [k: string]: unknown }
export interface RecentApplication { candidate_name?: string; vacancy_title?: string; stage_value?: string; created_at?: string; [k: string]: unknown }
export interface RecentLead { name?: string; contact_name?: string; status_value?: string; created_at?: string; [k: string]: unknown }
export interface AiRun { name?: string; ran_at?: string; ok?: boolean; processed?: number; error?: string; [k: string]: unknown }
export interface Conversation { name?: string; last_message?: string; at?: string; [k: string]: unknown }
export interface TimeseriesPoint { name: string; value?: number; [k: string]: unknown }

// K-173 fase 1 — the honest scope the server actually queried (never inferred
// client-side): which role resolved, whether it narrowed to "my own" records,
// which branches, and whether unassigned rows were folded in.
export interface DashScope {
  role?: string
  owner_dimension?: string | null
  owner_id?: string | number | null
  branch_ids?: Array<string | number>
  includes_unassigned?: boolean
  unassigned_count?: number
  computed_at?: string
}

// K-173 fase 2 — per-KPI drill descriptor: the exact list filters that reproduce
// the tile's own number. `null` = this KPI has no drill (tile renders inert).
export interface DashDrillDescriptor { entity: string; params: Record<string, unknown> }

// K-173 fase 6 — recruitment_manager team load feed.
export interface RecruiterLoadRow {
  user_id: string | number
  name: string
  open_tasks: number
  intakes_planned: number
  too_long_in_stage: number
  [k: string]: unknown
}

// K-173 fase 6 — sales_manager / accountmanager opportunity-ageing buckets.
export interface OppAgingBucket { bucket: '0-7' | '8-30' | '31-90' | '90+'; count: number }

// One merged row of the weekly trend chart (a value per series key + the bucket name).
export interface TrendRow { name: string; [k: string]: number | string }

// widget feeds v3 (DashboardService::v3Feeds) — presence on DashData = role +
// permission/module gate; an absent key means "not for this role", an empty
// array means "nothing today". Row shapes measured from the backend feed classes.
export interface TaskDueTodayRow { task_id: string; title: string; priority: { value: string; label: string; color?: string | null } | null; due_time: string | null; assignee_id: string | null; assignee: { id: string; name: string | null } | null }
export interface AppointmentNext48hRow { appointment_id: string; candidate_id: string; candidate: { id: string; name: string } | null; scheduled_at: string; type: string; application_id: string | null }
export interface ProductivityByRecruiterRow { user_id: string; name: string | null; proposals: number; placements: number }
export interface RedeployRadarRow { candidate_id: string; candidate: { id: string; name: string } | null; match_id: string; customer: { id: string; name: string } | null; end_date: string; days_left: number }
export interface FillRatePoint { date: string; total: number; filled: number; rate: number | null }
export interface FillRateByBranchRow { branch_id: string | null; branch: string; total: number; filled: number; rate: number | null }
export interface OppsByStageByOwnerRow { stage_id: string; stage_label: string; by_owner: { owner_id: string | null; name: string; count: number }[] }
export interface OppStalledRow { id: string; title: string; customer: string | null; owner: string; stage_label: string | null; days_still: number; value: number | null }
export interface ActivityByOwnerRow { owner_id: string | null; name: string; activity: number }
export interface PipelineValuePoint { date: string; value: number }
export interface CustomerAtRiskRow { id: string; name: string; owner: string; last_contact_at: string | null; days_quiet: number }
export interface CustomerByPhaseRow { value: string; label: string; count: number }
export interface VacancyAttentionRow { vacancy_id: string; title: string; customer: string | null; days_open: number; candidates_in_process: number; last_application_at: string | null }
export interface VacanciesByCustomerRow { customer_id: string; name: string; by_status: { status_id: string; label: string; count: number }[] }
export interface DocumentAttentionRow { candidate_id: string; name: string; issue: 'missing_cv' | 'expiring'; expires_at: string | null; days_left: number | null }
export interface CouplingErrorRow { entity_type: string; entity_id: string; entity_label: string; system: 'shiftmanager' | 'helloflex'; error: string | null; synced_at: string | null }
export interface MatchesByContractTypeRow { value: string; label: string; color: string | null; count: number }
export interface PlacementStartedTodayRow { match_id: string; candidate: string | null; customer: string | null; contract_ok: boolean; document_ok: boolean; koppeling_ok: boolean }
export interface PlacementTodayRow { match_id: string; candidate: string | null; customer: string | null }
export interface PlacementsStartedEndedToday { started: PlacementTodayRow[]; ended: PlacementTodayRow[] }
export interface ShiftCoverageCell { date: string; part: 'morning' | 'afternoon' | 'evening'; shifts: number; filled: number }
export interface OpenShiftRow { shift_id: string; start_time: string; end_time: string | null; order_title: string | null; status: 'open' }
// customer_id: null = no customer on the shift's order (CMBE 0ecd0bf5); bar stays inert for that row.
export interface OccupancyByCustomerRow { label: string; shifts: number; filled: number; rate: number | null; customer_id: string | null }
export interface ShiftStatusTodayRow { status: string; count: number }
export interface ShiftUnconfirmedRow { schedule_id: string; candidate_id: string; candidate: string | null; shift_start: string | null; order_title: string | null }

// K-193 fase 2b D — WhatsApp Web send-queue feed (CONTRACT f293cfec). Presence-based:
// only present with module whatsapp_web + page.whatsapp; absent otherwise (not `[]`).
// est_drain_hours null = no device connected (queue cannot drain).
export interface WaWebQueueNumberRow { number_id: string; label: string | null; rate_limit: number; in_queue: number; est_drain: number | null }
export interface WaWebQueueFeed { in_queue: number; sending: number; failed: number; est_drain_hours: number | null; devices: number; numbers: WaWebQueueNumberRow[] }

// GET /dashboard (single summary call).
export interface DashData {
  charts?: { by_funnel?: StatItem[]; timeseries?: Record<string, TimeseriesPoint[] | undefined> }
  recent?: { candidates?: RecentCandidate[]; applications?: RecentApplication[]; leads?: RecentLead[] }
  ai_runs?: AiRun[]
  conversations?: Conversation[]
  filters?: { locations?: Array<{ id: string | number; name: string }>; statuses?: Array<{ value: string; label: string }> }
  // Source freshness: when each planning connection last synced its mirror.
  sync_sources?: Array<{ system: string; label: string; last_synced_at?: string | null }>
  // KD11 (DASHP36) — sales/account-manager widget feeds (see above); absent
  // (not `[]`) when the viewer lacks the matching view-permission.
  expiring_matches?: ExpiringMatch[]
  stale_vacancies?: StaleVacancy[]
  koios_suggestions?: KoiosSuggestion[]
  customers_by_owner?: CustomerByOwner[]
  // K1 (DASH-KPI-SERVER-FE-1, BE K-168) — server-computed KPI values, pinned
  // key set. null = no right/module for this key (UI renders '—'); 0 = a real
  // zero; a module-gated key is ABSENT (not a key at all, not `null`) when the
  // tenant lacks the module — that absence is what hides the tile.
  kpis?: Record<string, number | null>
  // K-173 (714eae01): the viewer-effective ordered KPI row in SERVER keys —
  // presence = visible, position = order (saved via PUT /dashboard/kpis/{role},
  // role-default otherwise). When present this replaces the settings-blob
  // hidden/order path entirely.
  kpi_row?: string[]
  // K-173 fase 1 — the resolved scope this response was computed under.
  scope?: DashScope
  // K-173 fase 2 — per-KPI-id drill descriptor (key mirrors the `kpis` key,
  // e.g. `candidates_total`); an explicit `null` value means "no drill", so a
  // tile renders without onClick rather than falling back silently.
  drills?: Record<string, DashDrillDescriptor | null>
  // K-173 fase 6 — recruitment_manager / sales_manager+accountmanager feeds.
  recruiter_load?: RecruiterLoadRow[]
  opp_aging?: OppAgingBucket[]
  // widget feeds v3 (DashboardService::v3Feeds) — 24 role-gated feeds consumed
  // by blocks/feedRegistry.ts tiles. Each key is optional/absent when the role
  // or module gate does not apply; an empty array is a real "nothing today".
  tasks_due_today?: TaskDueTodayRow[]
  appointments_next_48h?: AppointmentNext48hRow[]
  productivity_by_recruiter?: ProductivityByRecruiterRow[]
  redeploy_radar?: RedeployRadarRow[]
  fill_rate_timeseries?: FillRatePoint[]
  fill_rate_by_branch?: FillRateByBranchRow[]
  opps_by_stage_by_owner?: OppsByStageByOwnerRow[]
  opps_stalled_list?: OppStalledRow[]
  activity_by_owner?: ActivityByOwnerRow[]
  pipeline_value_timeseries?: PipelineValuePoint[]
  customers_at_risk_list?: CustomerAtRiskRow[]
  customers_by_phase?: CustomerByPhaseRow[]
  vacancies_attention_by_customer?: VacancyAttentionRow[]
  vacancies_by_customer?: VacanciesByCustomerRow[]
  documents_attention?: DocumentAttentionRow[]
  coupling_errors_list?: CouplingErrorRow[]
  matches_by_contract_type?: MatchesByContractTypeRow[]
  placements_started_today?: PlacementStartedTodayRow[]
  placements_started_ended_today?: PlacementsStartedEndedToday
  shift_coverage_heatmap?: ShiftCoverageCell[]
  open_shifts_list?: OpenShiftRow[]
  occupancy_by_customer?: OccupancyByCustomerRow[]
  shift_status_today?: ShiftStatusTodayRow[]
  shifts_unconfirmed_list?: ShiftUnconfirmedRow[]
  // K-193 fase 2b D — WhatsApp Web queue tile (blocks/ops/WaWebQueueTile.tsx).
  wa_web_queue?: WaWebQueueFeed
  [k: string]: unknown
}
