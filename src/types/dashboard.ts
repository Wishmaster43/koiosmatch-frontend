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

// /opportunities/stats
export interface DashOpp {
  by_stage?: StatItem[]
  total?: number
  pipeline_value?: number | null
  [k: string]: unknown
}

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
  [k: string]: unknown
}
