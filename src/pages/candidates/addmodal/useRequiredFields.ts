/**
 * useRequiredFields — resolves which fields are required for the picked phase
 * (Settings → Verplichte velden), with a sensible fallback. Split out of
 * AddCandidateModal.tsx (§3 size discipline: the container had grown past the
 * 400-line split trigger) — a self-contained concern: given the current phase,
 * read the tenant setting and hand back `isReq`.
 */
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { normalizeRequiredFieldKeys } from '@/lib/requiredFieldKeys'
import type { FormState } from '../AddCandidateModal'

// Maps the backend field keys (the COLUMN keys the settings screen stores, e.g. `postcode`,
// `linkedin_slug`) to this form's field names — every input the modal has (Danny 09-09,
// row 17: the map knew ten keys and `postal_code`, so a required postcode showed no star).
const REQ_FIELD_MAP: Record<string, keyof FormState> = {
  first_name: 'firstName', middle_name: 'middleName', last_name: 'lastName', function_title: 'functionTitle',
  email: 'email', phone: 'phone', mobile: 'mobile', date_of_birth: 'dateOfBirth', gender: 'gender',
  preferred_language: 'preferredLanguage',
  street: 'street', house_number: 'houseNumber', house_number_suffix: 'houseNumberSuffix', address_line_2: 'addressLine2',
  postcode: 'postalCode', city: 'city', province: 'province', country: 'country',
  owner_id: 'ownerId', description: 'summary', linkedin_slug: 'linkedin',
}

// Resolves the required-field set for the given phase from the tenant setting, with the Settings-mirrored fallback defined above.
export function useRequiredFields(status: string) {
  const settings = useAllSettings()
  const requiredCfg = getJsonSetting<Record<string, string[]>>(settings, 'candidate_required_fields',
    // Fallback mirrors CandidateRequiredFieldsSettings' DEFAULTS (email/phone not required by default — Danny punt 3).
    { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'function_title'] })
  // Legacy keys a tenant may still have stored (postal_code, linkedin, summary) fold onto the column keys first.
  const requiredForm = normalizeRequiredFieldKeys(requiredCfg[status] ?? requiredCfg.lead ?? []).map(k => REQ_FIELD_MAP[k]).filter(Boolean) as Array<keyof FormState>
  const isReq = (k: keyof FormState) => requiredForm.includes(k)

  return { requiredForm, isReq }
}
