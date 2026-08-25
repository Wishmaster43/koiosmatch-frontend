import { useMemo } from 'react'
/**
 * useWorkPermitTypes — tenant-configurable work-permit-kind lookup
 * (KAND-WERKVERGUNNING-LOOKUP-1). candidates.work_permit_type moved from a
 * free-text string to this lookup's `value` slug (CandidateProfileRequest now
 * validates it with `Rule::exists('work_permit_types', 'value')` — verified
 * live: PATCH /candidates/{id} still takes the plain slug STRING, not the row
 * id, same convention as gender/nationality).
 *
 * Fed by the API (GET /work-permit-types → {id,value,label,color,sort_order,
 * active,in_use}) with a Dutch-market default as fallback while the API is
 * empty/unavailable — mirrors useGenders/useNationalities (CFG-1). The
 * fallback below mirrors the backend's own CandidateLookupSeeder defaults
 * exactly (value/label/color) so a freshly seeded tenant and this fallback
 * agree. Managed in Settings → Kandidaten → Werkvergunning.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'
import { unwrapList } from '@/lib/api'

// Seed DATA mirroring CandidateLookupSeeder::run() (koiosmatch-api) 1:1 — not a
// UI styling choice, hence the ad-hoc hex (CLAUDE.md §4 DATA exemption).
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_WORK_PERMIT_TYPES: LookupOption[] = [
  { value: 'geen_vergunning_nodig', label: 'Geen vergunning nodig (NL/EU)', color: '#79B58E' },
  { value: 'twv', label: 'Tewerkstellingsvergunning (TWV)', color: '#DDA071' },
  { value: 'gvva', label: 'Gecombineerde vergunning (GVVA)', color: '#6E8FD6' },
  { value: 'kennismigrant', label: 'Kennismigrant', color: '#8C86D9' },
  { value: 'onbekend', label: 'Onbekend', color: '#94A3B8' },
]
/* eslint-enable no-restricted-syntax */

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapWorkPermitTypes = (res: AxiosResponse): LookupOption[] | null => {
  const d = ((unwrapList(res).rows) as LookupOption[]).filter(Boolean)
  return d.length ? d : null
}

export function useWorkPermitTypes() {
  const { t } = useTranslation('candidates')
  const { data: rawTypes } = useCachedLookup('/work-permit-types', mapWorkPermitTypes, DEFAULT_WORK_PERMIT_TYPES)
  // Translate labels only while still on the SEED fallback (reference-equal to the
  // DEFAULT_WORK_PERMIT_TYPES const) — real tenant-configured API labels pass
  // through untouched; the literal Dutch seed text is the defaultValue.
  const workPermitTypes = useMemo(() => rawTypes === DEFAULT_WORK_PERMIT_TYPES
    ? rawTypes.map(w => ({ ...w, label: t(`lookupSeeds.workPermitTypes.${w.value}`, { defaultValue: w.label }) }))
    : rawTypes, [rawTypes, t])
  return { workPermitTypes }
}
