/**
 * candidateStatusInfo — pure helpers extracted from CandidateDrawer (§0.3 split):
 * the status lookup flag type and the phase required-field completeness check.
 * No state, no side effects — just computation, so it's unit-testable and keeps
 * the drawer container focused on wiring.
 */
import { getJsonSetting } from '@/lib/settings/useAllSettings'
import type { Candidate } from '@/types/candidate'
import type { LookupOption } from '@/types/common'

// The status lookup row with its behaviour flags (§3B — flag-driven, never slug).
export type StatusFlags = (LookupOption & { requires_reason?: boolean; expects_return_date?: boolean; is_blacklist?: boolean }) | undefined

// Phase required-field completeness (Settings → Verplichte velden) mapped to candidate
// fields → returns a predicate: is this phase's required set already filled in?
export function makeRequiredComplete(c: Candidate, allSettings: Parameters<typeof getJsonSetting>[0]) {
  const REQ_GET: Record<string, () => unknown> = {
    first_name: () => c.name, last_name: () => c.name, email: () => c.email, phone: () => c.phone,
    function_title: () => c.title, date_of_birth: () => c.dob, gender: () => c.gender,
    street: () => c.street, postal_code: () => c.postalCode, city: () => c.city,
  }
  return (phaseVal: string): boolean => {
    const cfg = getJsonSetting<Record<string, string[]>>(allSettings, 'candidate_required_fields',
      { lead: ['first_name', 'last_name'], candidate: ['first_name', 'last_name', 'email', 'phone', 'function_title'] })
    return (cfg[phaseVal] ?? []).every(k => { const g = REQ_GET[k]; return g ? String(g() ?? '').trim() !== '' : true })
  }
}
