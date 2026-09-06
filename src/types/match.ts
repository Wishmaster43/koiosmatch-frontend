/**
 * Match types. A match is the continuation of a Hired application; this
 * feature is a read-only list (page + table), so we type the raw API shape we
 * map from and the flat row the table renders.
 */
import type { Id } from './common'
import type { DeletionLifecycle } from './deletion'
import type { ApiBackofficeLink, BackofficeLink } from '@/lib/backofficeLink'
import type { ApiKoiosAiAdvice, KoiosAiAdvice } from '@/lib/koiosAdviceMap'

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

// One renewal record from the renewals chain (MATCH-RENEWAL-1).
export interface MatchRenewal {
  id?: Id
  sequence?: number
  old_end_date?: string | null
  new_end_date?: string | null
  created_by?: string | number | null
  created_at?: string | null
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
  // MATCH-CLIENT-EDIT (K-281): whether HelloFlex already holds a contract for
  // this match — 'none' (or absent) means the client is still free to change;
  // any other value, or a set GUID below, locks it (MatchClientGuard.php,
  // same fields the list AND detail resources both serialize).
  contract_status?: string | null
  helloflex_contract_guid?: string | null
  // MATCH-ORDINAL-1 (M14/M15): the customer site the match sits at — already
  // serialized by MatchListResource.php but previously dropped by mapMatch.
  customer_location_id?: string | number | null
  customer_department_id?: string | number | null
  // K-281 repair (MUST-FIX/NOTE c): MATCH-ORDINAL-2's nested display objects
  // (MatchListResource.php, list resource only — the detail resource still
  // ships only the flat _id fields) — mapMatch previously dropped these too,
  // same as the _id fields above were before MATCH-ORDINAL-1.
  customer_location?: { id?: string | number; name?: string } | null
  customer_department?: { id?: string | number; name?: string } | null
  vacancy_title?: string
  vacancy?: { id?: string | number; title?: string }
  // `client_name`/`client` resolve from the VACANCY's client_id, never this
  // match's own customer_id (ResolvesOwnersAndClients::attachClientNames) —
  // see MatchRow.client's own comment. `customer` is the match's OWN
  // customer {id, name} (K-281 repair pass 3, CMBE 06:25 contract,
  // MatchListResource/MatchDetailResource) — absent on payloads from before
  // the backend shipped it, mapped tolerantly to MatchRow.customerName.
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
  // MATCH-RENEWAL-1: the renewal history chain — detail-only, array of renewal records.
  renewals?: MatchRenewal[]
  // S1 K-266/K-267: the new AI advice cache (MatchDetailResource::koios_ai_advice /
  // MatchListResource's compact verdict+score).
  koios_ai_advice?: ApiKoiosAiAdvice | null
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
  // K-281 repair pass 3 (Opus find): despite the name, this is the VACANCY's
  // customer (backend `client_name`, resolved from optional($model->vacancy)
  // ->client_id — ResolvesOwnersAndClients::attachClientNames), NOT this
  // match's own customer_id. See `customerName` below for the match's own
  // customer; `clientId` is still the match's own customer_id (the id side
  // was always correct — only this name string points at the vacancy).
  client: string
  // Flat FKs (§3A cross-entity links) — power the Relations tab's hyperlinks to
  // the candidate/vacancy/customer's own page + drawer (EntityLink).
  candidateId: Id | null
  vacancyId: Id | null
  clientId: Id | null
  // MATCH-CLIENT-EDIT (K-281): mapped straight off contract_status/
  // helloflex_contract_guid — undefined/null means unlocked (either the
  // payload predates this field, or the seeded default 'none' applies).
  contractStatus?: string | null
  helloflexContractGuid?: string | null
  // MATCH-ORDINAL-1 (M14/M15): the customer site axes as ids, used to compute
  // "Nth match at this location/department" without a second round-trip; the
  // matching NAMES sit right below (customerLocationName/customerDepartmentName,
  // K-281). Optional: older row fixtures/tests that predate this axis simply
  // read as "no site" (null).
  customerLocationId?: Id | null
  customerDepartmentId?: Id | null
  // K-281 repair (NOTE c): the site's own name, straight off MatchListResource's
  // nested customer_location/customer_department objects — present on BOTH the
  // list AND the detail resource (MatchDetailResource::toArray builds on
  // `(new MatchListResource(...))->toArray()` and never overrides these two
  // keys, so the merge inherits them — corrected 04-09, an earlier comment
  // here wrongly called this list-only). Lets the reassign flow show the
  // CURRENT location/department by name (e.g. while the cascade fetch for the
  // picker is still loading, or the site was since archived) instead of a
  // bare id. null when the match carries no site, or the source payload
  // predates this field.
  customerLocationName?: string | null
  customerDepartmentName?: string | null
  // K-281 repair pass 3 (Opus find, CMBE 06:25 contract): the match's OWN
  // customer name — mapped from the NEW `customer: {id, name}` MatchListResource/
  // MatchDetailResource are adding (eager-loaded off customer_id). Distinct
  // from `client` below, which the backend resolves from the VACANCY's
  // client_id (ResolvesOwnersAndClients::attachClientNames) and can differ
  // from this match's own customer once MATCH-CLIENT-EDIT reassigns it. null
  // while the backend hasn't shipped the key yet, or the match carries no
  // customer_id — the client row then falls back to `client` (the vacancy's
  // customer) with the honest drawer.fields.clientViaVacancy label.
  customerName?: string | null
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
  // MATCH-ORIGIN-1 / TYPE-KOLOM-ROUTE: the application id the match grew out of
  // (only set when origin === 'application') — lets the Type cell deep-link to
  // that application's own drilldown instead of just naming the origin.
  applicationId?: string | number | null
  // MATCH-DRILL-2: termination read-back + renewal count — see RawMatch.termination
  // above for why these are hand-written. null/undefined = not terminated / no
  // renewals yet, never a fabricated value.
  stopReason?: string | null
  stopReasonLabel?: string | null
  terminationEffectiveDate?: string | null
  terminatedAt?: string | null
  renewalCount?: number | null
  // S1 K-266/K-267 (KOIOS-ADVIES-OVERAL-1): the per-record AI advice cache (a
  // real `koios_advice_match` workflow run). Required like the other four
  // entity types (S1 repair NOTE 7) — mapMatch always sets it, null when
  // absent, never undefined, so a host never needs a defensive `?? null`.
  koiosAiAdvice: KoiosAiAdvice | null
  [k: string]: unknown
}

// MATCH-APPROVAL-QUICKVIEW: GET /matches/stats response shape (MatchController::stats,
// aggregated over the same MatchQuery-filtered base the list uses). Hand-written —
// api-generated.ts carries no 2xx schema for this route yet (§10).
export interface MatchStats {
  total: number
  pending_approval: number
  by_origin: { direct: number; application: number }
}
