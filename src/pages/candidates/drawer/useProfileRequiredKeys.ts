/**
 * useProfileRequiredKeys — tenant-configurable required-field backend keys for
 * the candidate's current phase (Settings → Verplichte velden). Shared by the
 * three Profile sub-tabs (Personal/Address/Contact) so each only checks the
 * backend keys relevant to ITS OWN field subset, rather than duplicating the
 * settings lookup + fallback three times.
 */
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'

// Seed fallback shown before any tenant explicitly saves a required-fields
// config — a Lead/early Kandidaat may only have a name + function on file yet
// (Danny 2026-07-16, job 3); email/phone/gender/dob/address are opt-in.
const DEFAULT_REQUIRED: Record<string, string[]> = {
  lead: ['first_name', 'last_name'],
  candidate: ['first_name', 'last_name', 'function_title'],
}

// Returns the backend field-key list required for the given lifecycle phase.
export function useProfileRequiredKeys(phase: string): string[] {
  const settings = useAllSettings()
  const cfg = getJsonSetting<Record<string, string[]>>(settings, 'candidate_required_fields', DEFAULT_REQUIRED)
  return cfg[phase] ?? []
}
