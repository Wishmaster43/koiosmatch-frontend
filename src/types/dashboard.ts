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

// One merged row of the weekly trend chart (a value per series key + the bucket name).
export interface TrendRow { name: string; [k: string]: number | string }

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
  [k: string]: unknown
}
