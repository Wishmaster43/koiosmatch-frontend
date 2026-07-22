/**
 * Candidate page helpers — attention predicates (one source for both the counts
 * and the filter), the single-value toggle, small option helpers, initials, and
 * the UI-patch → API-body mapping used when saving drawer/header edits.
 */
import type { Candidate } from '@/types/candidate'

// Not contacted > N months: never contacted, or last contact older than the threshold. The
// threshold is the tenant setting `no_contact_alert_months` (Settings → KPI's → Candidates),
// default 6 — the caller passes it so the filter matches the configured KPI.
export const isStale = (c: Candidate, months = 6): boolean => {
  if (!c.lastContactAt) return true
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months)
  return new Date(c.lastContactAt) < cutoff
}
// No follow-up (page-local count fallback only; the real filter is the server no_followup param).
// Bug fix (Wave E3): this compared `status` (the Deployability axis: available/placed/
// unavailable/sick/leave) against 'lead', which is a Phase-axis value (§3B) — status
// never equals 'lead', so the fallback always returned false. Compare against `phase`.
export const isNoFollowup = (c: Candidate): boolean => c.phase === 'lead' && !c.lastContactAt
// Never contacted: no recorded contact moment at all (page-local fallback predicate).
export const isNeverContacted = (c: Candidate): boolean => !c.lastContactAt

// Set exactly one value in a multi-select, or clear when the same value is re-picked.
export const toggleOneValue = <T>(set: (updater: (prev: T[]) => T[]) => void, value: T): void =>
  set(p => (p.length === 1 && p[0] === value) ? [] : [value])

// Find the lookup meta for a value.
export const metaOf = <T extends { value: unknown }>(list: T[], v: unknown): T | undefined =>
  list.find(x => x.value === v)

// Build {value,label,count} option lists from a flat values array.
export const optsFrom = (
  values: Array<string | number>,
  mapLabel: (v: string) => string = (v) => v,
): Array<{ value: string; label: string; count: number }> => {
  const counts: Record<string, number> = {}
  values.forEach(v => { counts[v] = (counts[v] ?? 0) + 1 })
  return Object.keys(counts).map(v => ({ value: v, label: mapLabel(v), count: counts[v] }))
}

// Initials for avatars — re-exported from the shared util (single source).
export { initialsOf } from '@/lib/initials'

// Translate a drawer/header UI patch → the API body (3-layer model + profile
// fields + consent flags). Backend saves what it validates.
export const buildCandidatePatch = (patch: Record<string, unknown>): Record<string, unknown> => {
  const body: Record<string, unknown> = {}
  if ('candidateTypes' in patch) body.candidate_types = patch.candidateTypes
  if ('status'         in patch) body.status          = patch.status
  if ('phase'          in patch) body.phase           = patch.phase
  if ('status_reason'  in patch) body.status_reason   = patch.status_reason
  if ('blacklist_reason' in patch) body.blacklist_reason = patch.blacklist_reason
  // Camel UI keys (drawer optimistic merge) → API keys. statusChangedAt is display-only
  // (the backend stamps its own status_changed_at) and is deliberately NOT mapped.
  if ('statusReason'    in patch) body.status_reason        = patch.statusReason
  if ('blacklistReason' in patch) body.blacklist_reason     = patch.blacklistReason
  if ('statusReturnDate' in patch) body.available_again_date = patch.statusReturnDate
  // The backend validates `available_again_date` (CandidateProfileRequest) — the old
  // status_return_date key was silently dropped, so the return date never persisted.
  if ('status_return_date' in patch) body.available_again_date = patch.status_return_date
  if ('match_id'       in patch) body.match_id        = patch.match_id
  // Owner (recruiter) change from the drawer picker — used to be local-only.
  if ('ownerId'        in patch) body.owner_id        = patch.ownerId
  if ('availability'   in patch) body.availability    = patch.availability
  if ('stage'          in patch) body.funnel_type     = patch.stage
  if ('firstname'      in patch) body.first_name      = patch.firstname
  if ('lastname'       in patch) body.last_name       = patch.lastname
  if ('middleName'     in patch) body.middle_name     = patch.middleName
  if ('title'          in patch) body.function_title  = patch.title
  if ('gender'            in patch) body.gender            = patch.gender
  if ('nationality'       in patch) body.nationality       = patch.nationality
  if ('dob'               in patch) body.date_of_birth     = patch.dob
  if ('placeOfBirth'      in patch) body.place_of_birth    = patch.placeOfBirth
  if ('email'             in patch) body.email             = patch.email
  if ('phone'             in patch) body.phone             = patch.phone
  // Split field (BE 2026-07-20): mobile is validated separately on
  // CandidateProfileRequest (`mobile`), distinct from the landline `phone`.
  if ('mobile'            in patch) body.mobile            = patch.mobile
  if ('street'            in patch) body.street            = patch.street
  if ('houseNumber'       in patch) body.house_number      = patch.houseNumber
  if ('houseNumberSuffix' in patch) body.house_number_suffix = patch.houseNumberSuffix
  if ('postalCode'        in patch) body.postcode          = patch.postalCode
  if ('city'              in patch) body.city              = patch.city
  if ('province'          in patch) body.province          = patch.province
  // COUNTRY-1: home-address country (ISO-2 code); '' clears it (never send an empty string).
  if ('country'           in patch) body.country           = patch.country === '' ? null : patch.country
  if ('linkedin'          in patch) body.linkedin_slug     = patch.linkedin
  if ('summary'           in patch) body.summary           = patch.summary
  if ('languages'         in patch) body.languages         = patch.languages
  if ('preferences'       in patch) body.preferences       = patch.preferences
  // RATE-WISH-1: gewenst uurloon van-tot ('' -> null so clearing persists).
  if ('desiredRateMin' in patch) body.desired_rate_min = patch.desiredRateMin === '' ? null : patch.desiredRateMin
  if ('desiredRateMax' in patch) body.desired_rate_max = patch.desiredRateMax === '' ? null : patch.desiredRateMax
  // Tenant custom fields (Extra tab): both spellings map to the API key — this
  // was MISSING, so every eigen-velden save silently vanished (Danny 16-07).
  if ('customFields'      in patch) body.custom_fields     = patch.customFields
  if ('custom_fields'     in patch) body.custom_fields     = patch.custom_fields
  // ZZP=freelance flip (CMBE aac51b1): the resource now serialises/accepts `freelance`;
  // the FE keeps its internal `zzp` patch key but writes it under the new API key.
  if ('zzp'               in patch) body.freelance          = patch.zzp
  // Consent (C-11) → nested `consent` with ONLY the changed opt-in flags; never the
  // `_consent_at` timestamps (server-stamped). Send only the channels that are present.
  if ('consent' in patch) {
    const cs = (patch.consent ?? {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of ['whatsapp_opt_in', 'email_opt_in', 'newsletter_opt_in']) {
      if (k in cs) out[k] = cs[k]
    }
    // CMBE-RET-A (2026-07-22): the backend now validates consent.retention_opt_in,
    // so the retention checkbox's flip reaches the API too. The UI-side consent
    // object uses the camelCase key (mirrors mapCandidate.ts) — map it to the
    // snake_case API key the other channels above already use.
    if ('retentionOptIn' in cs) out.retention_opt_in = cs.retentionOptIn
    if (Object.keys(out).length) body.consent = out
  }
  return body
}
