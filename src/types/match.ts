/**
 * Match types. A match is the continuation of a Hired application; this
 * feature is a read-only list (page + table), so we type the raw API shape we
 * map from and the flat row the table renders.
 */
import type { Id } from './common'
import type { DeletionLifecycle } from './deletion'
import type { ApiBackofficeLink, BackofficeLink } from '@/lib/backofficeLink'

// MATCH-SOORT-1: the contract-form axis on a match — a candidate_types/
// Contractvorm lookup value, echoed as a resolved {value,label,color} object
// (never a bare slug) on every list AND detail row per the backend contract.
export interface MatchContractForm { value: string; label: string; color: string }

// One CONTRACTREGELS row (function + optional rate), only meaningful when the
// picked contract form carries `has_contract_lines`. `sortOrder` mirrors array
// position — the backend accepts a full replacing set on every write.
export interface MatchContractLine {
  id?: Id
  functionTitle: string
  rate: string
  sortOrder?: number
}

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
  // MATCH-ORDINAL-1 (M14/M15): the customer site the match sits at — already
  // serialized by MatchListResource.php but previously dropped by mapMatch.
  customer_location_id?: string | number | null
  customer_department_id?: string | number | null
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
  // MATCH-OWNER-1: the owner ID rides along on every row (MatchListResource.php:50),
  // so the drawer's owner picker can preselect the current owner by id, not by name.
  owner?: { id?: string | number; name?: string; avatar_color?: string | null }
  owner_name?: string
  created_at?: string
  matched_at?: string
  // VESTIGING-1: the bureau branch the match runs from (MatchListResource.php:35).
  branch?: { id?: string | number; name?: string } | null
  // MATCH-CARD-INFO-1 (Danny points 4/5): the contract window + function title —
  // MatchListResource.php:43-46 already ships all three on every list row.
  function_title?: string | null
  // M1 (overzicht-data cluster): the list resource already serialises this
  // (MatchListResource.php `contract_type`) — the mapper just never picked it up.
  contract_type?: string | null
  // MATCH-SOORT-1: contract FORM (Contractvorm) — distinct axis from
  // contract_type above; resolved {value,label,color} on list + detail rows.
  contract_form?: MatchContractForm | null
  // MATCH-ORIGIN-1: ONTSTAANSTYPE — whether this match grew out of an
  // application (Hired) or was created directly (§3B "two paths to a
  // placement"). Not shipped by the backend yet (CMBE briefed) — the mapper
  // gates on KEY PRESENCE (OFFERED-IFF-READ), never assuming a value from an
  // absent key. `[k: string]: unknown` already lets an absent key read as
  // `undefined` via `in`, so no extra optionality marker changes that.
  application_id?: string | number | null
  // MATCH-SOORT-1: CONTRACTREGELS — detail-only (echoed with id on GET /matches/{id}).
  contract_lines?: Array<{ id?: Id; function_title?: string | null; rate?: number | string | null; sort_order?: number | null }> | null
  start_date?: string | null
  end_date?: string | null
  // MATCH-ARCHIVED-LIST-1: soft-delete state (both list + detail rows now carry it —
  // see MatchListResource.php).
  archived?: boolean
  deleted_at?: string | null
  // TRASH-OVERAL-2: two-step trash lifecycle + the pending-erase stamp (list resource).
  lifecycle?: string
  pending_erase_at?: string | null
  // Approval workflow (MATCH-APPROVAL-1) — list carries the status; the rejection
  // reason is detail-only (fetched lazily, see useMatchApproval).
  approval_status?: string
  approval_rejected_reason?: string
  // Tenant custom-field values (§3B "Eigen velden").
  custom_fields?: Record<string, unknown>
  // EXTRACT-1: the shared raw shape (src/lib/backofficeLink) — the Koppelingen tab.
  backoffice_links?: ApiBackofficeLink[]
  // MATCH-DRILL-2: termination read-back (AttachesMatchParityFields, K-126). The
  // openapi spec only documents this nested shape on the /terminate 200 response
  // (no 2xx schema for GET /matches/{id} yet — measured, only 401 is typed) — the
  // list/detail resources share the same base class per WORKLIST, so this is
  // hand-written from that terminate response shape (CLAUDE.md §10).
  termination?: {
    stop_reason?: string | null
    stop_reason_label?: string | null
    effective_date?: string | null
    terminated_at?: string | null
    terminated_by?: string | null
  } | null
  // MATCH-DRILL-2: renewal count (1st/2nd/3rd renewal) — not in the openapi spec
  // at all (no /renew or detail 2xx schema is typed); hand-written per the
  // WORKLIST field name (AttachesMatchParityFields).
  renewal_count?: number | null
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
  // MATCH-ORDINAL-1 (M14/M15): the customer site axes — id-only (no name yet,
  // see the location/department ticket), used to compute "Nth match at this
  // location/department" without a second round-trip. Optional: older row
  // fixtures/tests that predate this axis simply read as "no site" (null).
  customerLocationId?: Id | null
  customerDepartmentId?: Id | null
  score: number | null
  stage: string
  // Lifecycle status slug (R-1b /match-statuses; the is_closed flag ends the match).
  status: string
  stageColor: string
  owner: string
  // MATCH-OWNER-1: the owner's user id — what the drawer's picker matches against
  // and what a reassignment PATCHes as `owner_id`; null when the row has no owner.
  ownerId: Id | null
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
  // EXTRACT-1: the backoffice links (Koppelingen tab), mapped from backoffice_links[].
  helloflexLink: BackofficeLink | null
  shiftmanagerLink: BackofficeLink | null
  // MATCH-ARCHIVED-LIST-1 (2026-07-18): server-backed now — MatchListResource carries
  // `archived`/`deleted_at` on every row (mapped by useMatches), reflecting the true
  // list-level state, not just a delete/restore this session performed.
  archived?: boolean
  archivedAt?: string | null
  // TRASH-OVERAL-2: trash lifecycle — 'pending_erase' rows live in the Prullenbak
  // view; the mapper derives a tolerant fallback for payloads that predate the field.
  lifecycle?: DeletionLifecycle
  pendingEraseAt?: string | null
  // MATCH-CARD-INFO-1 (Danny points 4/5): contract window + function/branch, shown
  // as extra rows on the read-only match card (customer/candidate/scoped views).
  functionTitle?: string | null
  branchName?: string | null
  startDate?: string | null
  endDate?: string | null
  // M1 (overzicht-data cluster): contract form/type, straight off the list resource.
  contractType?: string | null
  // MATCH-SOORT-1: the resolved Contractvorm chip value — null when unset.
  contractForm?: MatchContractForm | null
  // MATCH-ORIGIN-1: ONTSTAANSTYPE — 'application' (grew out of a Hired
  // application) or 'direct' (created without one). undefined (never a
  // fabricated value) until the raw payload actually carries the
  // `application_id` key — see mapMatch's OFFERED-IFF-READ comment.
  origin?: 'application' | 'direct'
  // MATCH-DRILL-2: termination read-back + renewal count — see RawMatch.termination
  // above for why these are hand-written. null/undefined = not terminated / no
  // renewals yet, never a fabricated value.
  stopReason?: string | null
  stopReasonLabel?: string | null
  terminationEffectiveDate?: string | null
  terminatedAt?: string | null
  renewalCount?: number | null
  [k: string]: unknown
}
