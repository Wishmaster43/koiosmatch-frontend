/**
 * Match types. A match is the continuation of an application → placement; this
 * feature is a read-only list (page + table), so we type the raw API shape we
 * map from and the flat row the table renders.
 */
import type { Id } from './common'

// The raw match as it can arrive from the API (snake_case-tolerant, nested or flat).
export interface RawMatch {
  id?: string | number
  // NUMMER-1: server-assigned human-readable reference number (M-00042).
  reference_number?: string
  candidate?: { id?: string | number; first_name?: string; last_name?: string; name?: string }
  candidate_name?: string
  // Flat FKs for clickable linkage ("golf 2" — MatchListResource) — the nested
  // objects above/below only add the display name/title.
  candidate_id?: string | number
  vacancy_id?: string | number
  customer_id?: string | number
  vacancy_title?: string
  vacancy?: { id?: string | number; title?: string }
  client_name?: string
  client?: { id?: string | number; name?: string }
  customer?: { id?: string | number; name?: string }
  score?: number | null
  match_score?: number | null
  stage_label?: string
  stage?: string
  status?: string
  stage_color?: string
  owner?: { name?: string; avatar_color?: string | null }
  owner_name?: string
  created_at?: string
  matched_at?: string
  // MATCH-ARCHIVED-LIST-1: soft-delete state (both list + detail rows now carry it —
  // see MatchListResource.php).
  archived?: boolean
  deleted_at?: string | null
  // Approval workflow (MATCH-APPROVAL-1) — list carries the status; the rejection
  // reason is detail-only (fetched lazily, see useMatchApproval).
  approval_status?: string
  approval_rejected_reason?: string
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  [k: string]: unknown
}

// The flat row the matches table renders.
export interface MatchRow {
  id?: string | number
  // NUMMER-1: human-readable reference number (M-00042), shown in the drawer + table.
  referenceNumber?: string
  candidate: string
  initials: string
  vacancy: string
  client: string
  // Flat FKs (§3A cross-entity links) — power the Relations tab's hyperlinks to
  // the candidate/vacancy/customer's own page + drawer (EntityLink).
  candidateId: Id | null
  vacancyId: Id | null
  clientId: Id | null
  score: number | null
  stage: string
  // Lifecycle status slug (R-1b /match-statuses; the is_closed flag ends the match).
  status: string
  stageColor: string
  owner: string
  // Owner avatar (§3A owner-cell convention) — colour is null when the API/mapper
  // has none, so the table falls back to the neutral grey (never a blank bubble).
  ownerInitials: string
  ownerColor: string | null
  date: string
  // Approval workflow — 'pending' | 'approved' | 'rejected'; reason is detail-only
  // (empty on the list row until useMatchApproval lazily fetches it for a rejected match).
  approval_status?: string
  approval_rejected_reason?: string
  // Tenant custom-field values (§3B "Eigen velden" — the drawer's gated Extra tab).
  customFieldValues?: Record<string, unknown>
  // MATCH-ARCHIVED-LIST-1 (2026-07-18): server-backed now — MatchListResource carries
  // `archived`/`deleted_at` on every row (mapped by useMatches), reflecting the true
  // list-level state, not just a delete/restore this session performed.
  archived?: boolean
  archivedAt?: string | null
  [k: string]: unknown
}
