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
  attention?: Record<string, number | null | undefined>
  [k: string]: unknown
}

// /applications/stats (D6) — only the attention block is read here.
export interface DashAppStats {
  attention?: Record<string, number | null | undefined>
  [k: string]: unknown
}

// /vacancies/stats (D1a) — only the attention block is read here.
export interface DashVacStats {
  attention?: Record<string, number | null | undefined>
  [k: string]: unknown
}

// /opportunities/stats
export interface DashOpp {
  by_stage?: StatItem[]
  total?: number
  pipeline_value?: number | null
  [k: string]: unknown
}

// KD11 (DASHP36) widget feeds — sales/account-manager dashboard templates.
// Present only for the matching view-permission; absent entirely (not `[]`)
// means the block is not shown for this role, mirroring the attention keys.
export interface ExpiringMatch { id?: string | number; candidate_id?: string | number; candidate_name?: string | null; customer_id?: string | number; customer_name?: string; end_date?: string; [k: string]: unknown }
export interface StaleLead { id?: string | number; name?: string; phase_changed_at?: string; [k: string]: unknown }
export interface StaleVacancy { id?: string | number; title?: string; published_at?: string; [k: string]: unknown }
export interface KoiosSuggestion { vacancy_id?: string | number; vacancy_title?: string; suggestions_count?: number; [k: string]: unknown }
// sales_manager only — the tenant-wide "where does business come from" breakdown.
export interface CustomerByOwner { owner_id?: string | number; name?: string; count?: number; [k: string]: unknown }

export interface RecentCandidate { name?: string; status_value?: string; role?: string; last_activity_at?: string; [k: string]: unknown }
export interface RecentApplication { candidate_name?: string; vacancy_title?: string; stage_value?: string; created_at?: string; [k: string]: unknown }
export interface RecentLead { name?: string; contact_name?: string; status_value?: string; created_at?: string; [k: string]: unknown }
// Recruitment candidate-focus feeds (owner-scoped by the backend; B-27).
export interface Touchpoint { candidate_id?: string | number; name?: string; type?: string; date?: string; [k: string]: unknown }
export interface AttentionCandidate { id?: string | number; name?: string; status_value?: string; last_contact_at?: string; [k: string]: unknown }
export interface AiRun { name?: string; ran_at?: string; ok?: boolean; processed?: number; error?: string; [k: string]: unknown }
export interface Conversation { name?: string; last_message?: string; at?: string; [k: string]: unknown }
export interface TimeseriesPoint { name: string; value?: number; [k: string]: unknown }

// One merged row of the weekly trend chart (a value per series key + the bucket name).
export interface TrendRow { name: string; [k: string]: number | string }

// GET /dashboard (single summary call).
export interface DashData {
  charts?: { by_funnel?: StatItem[]; timeseries?: Record<string, TimeseriesPoint[] | undefined> }
  recent?: { candidates?: RecentCandidate[]; applications?: RecentApplication[]; leads?: RecentLead[] }
  // Recruitment feeds (owner-scoped): today's touchpoints + candidates to work.
  touchpoints?: Touchpoint[]
  attention_candidates?: { stale6m?: AttentionCandidate[]; never_contacted?: AttentionCandidate[]; no_followup?: AttentionCandidate[] }
  ai_runs?: AiRun[]
  conversations?: Conversation[]
  filters?: { locations?: Array<{ id: string | number; name: string }>; statuses?: Array<{ value: string; label: string }> }
  // Source freshness: when each planning connection last synced its mirror.
  sync_sources?: Array<{ system: string; label: string; last_synced_at?: string | null }>
  // KD11 (DASHP36) — sales/account-manager widget feeds (see above); absent
  // (not `[]`) when the viewer lacks the matching view-permission.
  expiring_matches?: ExpiringMatch[]
  stale_leads?: StaleLead[]
  stale_vacancies?: StaleVacancy[]
  koios_suggestions?: KoiosSuggestion[]
  customers_by_owner?: CustomerByOwner[]
  [k: string]: unknown
}
