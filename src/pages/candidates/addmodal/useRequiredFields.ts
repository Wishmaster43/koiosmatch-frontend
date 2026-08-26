/**
 * useRequiredFields — resolves which fields are required for the picked phase
 * (Settings → Verplichte velden), with a sensible fallback. Split out of
 * AddCandidateModal.tsx (§3 size discipline: the container had grown past the
 * 400-line split trigger) — a self-contained concern: given the current phase,
 * read the tenant setting and hand back `isReq`.
 */
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import type { FormState } from '../AddCandidateModal'

// Maps the backend field keys to this form's field names.
const REQ_FIELD_MAP: Record<string, keyof FormState> = {
  first_name: 'firstName', last_name: 'lastName', email: 'email', phone: 'phone',
  function_title: 'functionTitle', date_of_birth: 'dateOfBirth', gender: 'gender',
  street: 'street', postal_code: 'postalCode', city: 'city',
}

// Resolves the required-field set for the given phase from the tenant setting, with the Settings-mirrored fallback defined above.
export function useRequiredFields(status: string) {
  const settings = useAllSettings()
  const requiredCfg = getJsonSetting<Record<string, string[]>>(settings, 'candidate_required_fields',
    // Fallback mirrors CandidateRequiredFieldsSettings' DEFAULTS (email/phone not required by default — Danny punt 3).
    { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'function_title'] })
  const requiredForm = (requiredCfg[status] ?? requiredCfg.lead ?? []).map(k => REQ_FIELD_MAP[k]).filter(Boolean) as Array<keyof FormState>
  const isReq = (k: keyof FormState) => requiredForm.includes(k)

  return { requiredForm, isReq }
}
