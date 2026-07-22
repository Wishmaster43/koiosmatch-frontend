/**
 * Vacancy page helpers — the single-value toggle, initials, the recharts key
 * picker, an optimistic-subset snapshot, and the UI-patch → API-body mapping
 * used when saving header/picker edits.
 */
import type { Dispatch, SetStateAction } from 'react'

// Set exactly one value in a multi-select, or clear when it's already the only one.
export const toggleOneValue = (set: Dispatch<SetStateAction<string[]>>, value: string) =>
  set(p => (p.length === 1 && p[0] === value) ? [] : [value])

// Two-letter initials — re-exported from the shared util (single source).
export { initialsOf } from '@/lib/initials'

// Recharts hands the clicked segment back at top level AND under `.payload`.
export const pickKey = (d: unknown): string | undefined => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  return o?.key ?? o?.payload?.key ?? o?.name
}

// One raw `/vacancies/stats` by_status row — the backend already resolves a label/
// colour itself (real name, or its own 'Onbekend'/'Geen status' copy), which the FE
// can use as a last-resort source before ever assuming "no status" (see below).
export interface RawStatusStat { value?: string | number | null; status?: string | number | null; label?: string; color?: string; count?: number }
export interface StatusMetaLike { label?: string; color?: string }
export interface StatusDonutSegment { name: string; value: number; key: string; color: string }

/**
 * resolveStatusSegment — one status-donut segment's display name/colour (V27 fix).
 *
 * Preference order: the live tenant lookup → any loaded row carrying that same
 * status id → the backend's own resolved label → a distinct "unknown" copy.
 * A real (non-null) status id that resolves nowhere is UNKNOWN, never "Geen
 * status" — the previous fallback here silently folded any unresolved-but-real
 * status into the no-status bucket, inflating it and never showing the segment's
 * own colour/count under its real (if unnamed) identity. Only a literal null
 * value (VAC-NOSTATUS-1's `?no_status=1` bucket) is genuinely "no status".
 */
export function resolveStatusSegment(
  raw: RawStatusStat,
  statusMeta: (v: string) => StatusMetaLike,
  rowMeta: Map<string, StatusMetaLike>,
  noStatusLabel: string,
  unknownLabel: string,
): StatusDonutSegment {
  const v = raw.value ?? raw.status
  if (v == null) return { name: noStatusLabel, value: raw.count ?? 0, key: '__none', color: '#9CA3AF' }
  const key = String(v)
  const m = statusMeta(key)
  const rm = rowMeta.get(key)
  const name = m.label || rm?.label || raw.label || unknownLabel
  const color = (m.label ? m.color : rm?.color) ?? raw.color ?? '#9CA3AF'
  return { name, value: raw.count ?? 0, key, color: color as string }
}

// Snapshot a subset of fields, for optimistic revert/reconcile.
export const subsetOf = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
  keys.reduce<Record<string, unknown>>((a, k) => { a[k] = obj[k]; return a }, {})

// Translate a drawer/header UI patch → the API body. The optimistic local fields
// (statusLabel/owner/clientName) are derived in the container; this is the persist body.
export const buildVacancyPatch = (patch: Record<string, unknown>): Record<string, unknown> => {
  const body: Record<string, unknown> = {}
  // V7 (VACATURES-100): inline title edit in the drawer header (mirror OpportunityDrawer).
  if ('title'               in patch) body.title                = patch.title
  if ('statusValue'         in patch) body.status               = patch.statusValue
  if ('ownerId'             in patch) body.owner_id             = patch.ownerId
  if ('clientId'            in patch) body.customer_id          = patch.clientId
  // VAC-AGENT-1: linking an agent IS the interview on/off switch (Option A) —
  // null unlinks (no separate flow field, the agent carries its own flow).
  if ('aiAgentId'           in patch) body.ai_agent_id          = patch.aiAgentId
  // V3-V6 (VACATURES-100): klant → locatie → afdeling → contactpersoon cascade on the
  // Algemeen card. VAC-CASCADE-1 (backend wave 6): customer_location_id/
  // customer_department_id/contact_id are real columns on `vacancies`, whitelisted
  // in VacancyWriter's scalar passthrough — this persists for real (proven by
  // VacancyCascadeTest's round-trip).
  if ('customerLocationId'   in patch) body.customer_location_id   = patch.customerLocationId
  if ('customerDepartmentId' in patch) body.customer_department_id = patch.customerDepartmentId
  if ('contactId'             in patch) body.contact_id             = patch.contactId
  if ('tags'                in patch) body.tags                 = patch.tags
  if ('channels'            in patch) body.published_channels   = patch.channels
  if ('applicationSettings' in patch) body.application_settings = patch.applicationSettings
  if ('matchWeights'        in patch) body.match_weights        = patch.matchWeights
  // MATCH-TEMPLATE-1: assigning a template — the backend snapshots its weights onto
  // this vacancy and returns the resolved match_weights in the same response.
  if ('matchWeightTemplateId' in patch) body.match_weight_template_id = patch.matchWeightTemplateId
  // Details tab fields — contract forms, lookup slugs, structured address/salary/hours.
  if ('contractTypes'   in patch) body.contract_types     = patch.contractTypes
  if ('seniorityValue'  in patch) body.seniority          = patch.seniorityValue
  if ('educationValue'  in patch) body.education          = patch.educationValue
  if ('industry'        in patch) body.industry           = patch.industry
  if ('category'        in patch) body.category           = patch.category
  if ('street'          in patch) body.street             = patch.street
  if ('houseNumber'     in patch) body.house_number       = patch.houseNumber
  if ('houseNumberSuffix' in patch) body.house_number_suffix = patch.houseNumberSuffix
  if ('postalCode'      in patch) body.postcode           = patch.postalCode
  if ('city'            in patch) body.city               = patch.city
  if ('province'        in patch) body.province           = patch.province
  // VAC-COUNTRY-1: mirrors the province convention above — plain field name, the
  // backend maps it onto location_country (VacancyWriter). LIVE since CMBE shipped
  // VAC-COUNTRY-WRITE-1 (22-07): the request rule + writer mapping + detail emit
  // all exist, so this persists for real now (audit 22-07: comment was stale).
  if ('country'         in patch) body.country            = patch.country
  if ('location'        in patch) body.location           = patch.location
  if ('experienceMin'   in patch) body.experience_min_years = patch.experienceMin
  if ('experienceMax'   in patch) body.experience_max_years = patch.experienceMax
  if ('salaryMin'       in patch) body.salary_min         = patch.salaryMin
  if ('salaryMax'       in patch) body.salary_max         = patch.salaryMax
  if ('hoursMin'        in patch) body.hours_min          = patch.hoursMin
  if ('hoursMax'        in patch) body.hours_max          = patch.hoursMax
  if ('description'     in patch) body.description        = patch.description
  if ('skills'          in patch) body.skills             = patch.skills
  // VAC-DATES-1: the vacancy's own runtime window (validated after_or_equal:start_date BE-side).
  if ('startDate'       in patch) body.start_date         = patch.startDate
  if ('endDate'         in patch) body.end_date           = patch.endDate
  // Extra tab — per-vacancy custom-field values map.
  if ('customFieldValues' in patch) body.custom_fields    = patch.customFieldValues
  return body
}
