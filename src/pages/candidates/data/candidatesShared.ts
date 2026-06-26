/**
 * Candidate page helpers — attention predicates (one source for both the counts
 * and the filter), the single-value toggle, small option helpers, initials, and
 * the UI-patch → API-body mapping used when saving drawer/header edits.
 */
import type { Candidate } from '@/types/candidate'

export const SIX_MONTHS_MS = 182 * 86400000

// Not contacted > 6 months: never contacted, or last contact older than 6 months.
export const isStale = (c: Candidate): boolean => {
  const t = c.lastContactAt ? new Date(c.lastContactAt).getTime() : null
  return t == null || (Date.now() - t) > SIX_MONTHS_MS
}
// No follow-up: a new lead without any contact.
export const isNoFollowup = (c: Candidate): boolean => c.status === 'lead' && !c.lastContactAt
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
  if ('street'            in patch) body.street            = patch.street
  if ('houseNumber'       in patch) body.house_number      = patch.houseNumber
  if ('houseNumberSuffix' in patch) body.house_number_suffix = patch.houseNumberSuffix
  if ('postalCode'        in patch) body.postcode          = patch.postalCode
  if ('city'              in patch) body.city              = patch.city
  if ('province'          in patch) body.province          = patch.province
  if ('linkedin'          in patch) body.linkedin_slug     = patch.linkedin
  if ('summary'           in patch) body.summary           = patch.summary
  if ('languages'         in patch) body.languages         = patch.languages
  if ('preferences'       in patch) body.preferences       = patch.preferences
  if ('zzp'               in patch) body.zzp               = patch.zzp
  // Consent toggles → flat booleans (the `_at` timestamps are stamped server-side).
  if ('consent' in patch) {
    const cs = (patch.consent ?? {}) as Record<string, unknown>
    if ('whatsapp_consent'   in cs) body.whatsapp_consent   = cs.whatsapp_consent
    if ('email_consent'      in cs) body.email_consent      = cs.email_consent
    if ('newsletter_consent' in cs) body.newsletter_consent = cs.newsletter_consent
  }
  return body
}
