/**
 * Match types. A match is the continuation of an application → placement; this
 * feature is a read-only list (page + table), so we type the raw API shape we
 * map from and the flat row the table renders.
 */

// The raw match as it can arrive from the API (snake_case-tolerant, nested or flat).
export interface RawMatch {
  id?: string | number
  candidate?: { first_name?: string; last_name?: string; name?: string }
  candidate_name?: string
  vacancy_title?: string
  vacancy?: { title?: string }
  client_name?: string
  client?: { name?: string }
  customer?: { name?: string }
  score?: number | null
  match_score?: number | null
  stage_label?: string
  stage?: string
  status?: string
  stage_color?: string
  owner?: { name?: string }
  owner_name?: string
  created_at?: string
  matched_at?: string
  [k: string]: unknown
}

// The flat row the matches table renders.
export interface MatchRow {
  id?: string | number
  candidate: string
  initials: string
  vacancy: string
  client: string
  score: number | null
  stage: string
  // Lifecycle status slug (R-1b /match-statuses; the is_closed flag ends the match).
  status: string
  stageColor: string
  owner: string
  date: string
  [k: string]: unknown
}
