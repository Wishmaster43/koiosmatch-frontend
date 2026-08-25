/**
 * useEmergencyContactRelations — tenant-configurable relation lookup
 * (NOODCONTACT-VELDEN-1). Feeds candidate_preferences.emergency_contact_relation_id.
 *
 * UNLIKE gender/nationality/work-permit-type (which validate the lookup's `value`
 * SLUG), the backend validates this one BY ROW ID —
 * `Rule::exists('emergency_contact_relations', 'id')`, CandidateProfileRequest.php:172
 * — verified live 2026-08-08 (PATCH /candidates/{id} with `emergency_contact_relation_id`
 * set to a slug/label instead of the row id returned a 422 "must be a valid UUID").
 * A tenant renaming a relation must never orphan an already-stored candidate row
 * (same reasoning as WhatsappMessageType/EducationLevel). Callers must send the
 * option's `id`, never its `value` slug or `label`.
 *
 * Fed by the API (GET /emergency-contact-relations → {id,value,label,color,
 * sort_order,active,in_use}, verified live) with a Dutch-market default as fallback
 * while the API is empty/unavailable — mirrors useGenders/useWorkPermitTypes (CFG-1).
 * The fallback below mirrors the backend's own CandidateLookupSeeder defaults
 * exactly (value/label/color, verified live against the seeded `demo` tenant); its
 * `id` is a synthetic placeholder (never a real server row id) — a save attempted
 * while genuinely offline/empty would correctly 422, the same limitation every
 * fallback-backed lookup in this codebase already carries. Managed in
 * Settings → Kandidaten → Noodcontact-relaties.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// A lookup option with its row `id` typed as a real string (not the base
// interface's catch-all `unknown`) — every caller needs `id` for the save path.
export interface EmergencyContactRelationOption extends LookupOption {
  id: string
}

// Seed DATA mirroring CandidateLookupSeeder::run() (koiosmatch-api) 1:1 — not a
// UI styling choice, hence the ad-hoc hex (CLAUDE.md §4 DATA exemption). `id`
// here is a synthetic placeholder (see file header), never a real server row id.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_EMERGENCY_CONTACT_RELATIONS: EmergencyContactRelationOption[] = [
  { id: 'partner',   value: 'partner',   label: 'Partner',    color: '#6E8FD6' },
  { id: 'ouder',     value: 'ouder',     label: 'Ouder',      color: '#79B58E' },
  { id: 'kind',      value: 'kind',      label: 'Kind',       color: '#DDA071' },
  { id: 'broer_zus', value: 'broer_zus', label: 'Broer/zus',  color: '#8C86D9' },
  { id: 'vriend',    value: 'vriend',    label: 'Vriend(in)', color: '#5FB0AC' },
  { id: 'familie',   value: 'familie',   label: 'Familie',    color: '#C98BBA' },
  { id: 'anders',    value: 'anders',    label: 'Anders',     color: '#94A3B8' },
]
/* eslint-enable no-restricted-syntax */

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapEmergencyContactRelations = (res: AxiosResponse): EmergencyContactRelationOption[] | null => {
  const d = ((unwrapList(res).rows) as EmergencyContactRelationOption[]).filter(Boolean)
  return d.length ? d : null
}

export function useEmergencyContactRelations() {
  const { t } = useTranslation('common')
  const { data: rawRelations } = useCachedLookup(
    '/emergency-contact-relations', mapEmergencyContactRelations, DEFAULT_EMERGENCY_CONTACT_RELATIONS,
  )
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const emergencyContactRelations = useMemo(() => translateSeedList(t, 'emergencyRelations', rawRelations), [rawRelations, t])
  return { emergencyContactRelations }
}
