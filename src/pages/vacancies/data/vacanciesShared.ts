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

// Snapshot a subset of fields, for optimistic revert/reconcile.
export const subsetOf = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> =>
  keys.reduce<Record<string, unknown>>((a, k) => { a[k] = obj[k]; return a }, {})

// Translate a drawer/header UI patch → the API body. The optimistic local fields
// (statusLabel/owner/clientName) are derived in the container; this is the persist body.
export const buildVacancyPatch = (patch: Record<string, unknown>): Record<string, unknown> => {
  const body: Record<string, unknown> = {}
  if ('statusValue'         in patch) body.status               = patch.statusValue
  if ('ownerId'             in patch) body.owner_id             = patch.ownerId
  if ('clientId'            in patch) body.customer_id          = patch.clientId
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
  // Single-line address the BE accepts TODAY; the structured address/contract_types/
  // experience_min+max above need their validation rules BE-side first (VAC-PATCH-1).
  if ('location'        in patch) body.location           = patch.location
  if ('experienceMin'   in patch) body.experience_min_years = patch.experienceMin
  if ('experienceMax'   in patch) body.experience_max_years = patch.experienceMax
  if ('salaryMin'       in patch) body.salary_min         = patch.salaryMin
  if ('salaryMax'       in patch) body.salary_max         = patch.salaryMax
  if ('hoursMin'        in patch) body.hours_min          = patch.hoursMin
  if ('hoursMax'        in patch) body.hours_max          = patch.hoursMax
  if ('description'     in patch) body.description        = patch.description
  if ('skills'          in patch) body.skills             = patch.skills
  // Extra tab — per-vacancy custom-field values map.
  if ('customFieldValues' in patch) body.custom_fields    = patch.customFieldValues
  return body
}
