/**
 * useOpportunityLookups — tenant-configurable Kans lookups: service/sector type and
 * agreement type. Fed by the API with the seeds below as fallback while empty/loading
 * (worklist C-42). Mirrors useOpportunityStages. Each item carries the stable `value`
 * slug + editable label/colour and (from the API) the `id` used when writing the FK.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per URL
 * per session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { normalizeOptions } from './lookupUtils'
import type { LookupOption } from '@/types/common'
import { unwrap } from '@/lib/api'

// Service / sector — the kind of engagement (seed for healthcare staffing).
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_SERVICE_TYPES: LookupOption[] = [
  { value: 'detachering',      label: 'Detachering',      color: '#6E8FD6' },
  { value: 'zorg',             label: 'Zorg',             color: '#5FB0AC' },
  { value: 'zorg_detachering', label: 'Zorg-detachering', color: '#A98AD1' },
]
/* eslint-enable no-restricted-syntax */

// Agreement type — the contract form the deal runs under.
/* eslint-disable no-restricted-syntax -- seed DATA hex mirroring the backend seed, not UI styling */
export const DEFAULT_AGREEMENT_TYPES: LookupOption[] = [
  { value: 'cooperation', label: 'Samenwerkingsovereenkomst', color: '#6FA8C4' },
  { value: 'framework',   label: 'Mantelovereenkomst',        color: '#DDA071' },
]
/* eslint-enable no-restricted-syntax */

// Generic tenant lookup with a seed fallback; a 404/empty keeps the seed.
function useLookup(url: string, seed: LookupOption[]) {
  // null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
  const mapFn = (res: AxiosResponse): LookupOption[] | null => normalizeOptions(unwrap(res))
  const { data: items } = useCachedLookup(url, mapFn, seed)
  // value(slug) → item, with a neutral fallback so the UI never crashes.
  // eslint-disable-next-line no-restricted-syntax -- DATA fallback, not a UI colour choice
  const meta = (v?: string | null): LookupOption => items.find(i => i.value === v) ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF' }
  return { items, meta }
}

export function useOpportunityServiceTypes() {
  const { items, meta } = useLookup('/opportunity-service-types', DEFAULT_SERVICE_TYPES)
  return { serviceTypes: items, serviceTypeMeta: meta }
}

export function useOpportunityAgreementTypes() {
  const { items, meta } = useLookup('/opportunity-agreement-types', DEFAULT_AGREEMENT_TYPES)
  return { agreementTypes: items, agreementTypeMeta: meta }
}
