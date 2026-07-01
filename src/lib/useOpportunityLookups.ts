/**
 * useOpportunityLookups — tenant-configurable Kans lookups: service/sector type and
 * agreement type. Fed by the API with the seeds below as fallback while empty/loading
 * (worklist C-42). Mirrors useOpportunityStages. Each item carries the stable `value`
 * slug + editable label/colour and (from the API) the `id` used when writing the FK.
 */
import { useState, useEffect } from 'react'
import api from './api'
import { normalizeOptions } from './lookupUtils'
import type { LookupOption } from '@/types/common'

// Service / sector — the kind of engagement (seed for healthcare staffing).
export const DEFAULT_SERVICE_TYPES: LookupOption[] = [
  { value: 'detachering',      label: 'Detachering',      color: '#6E8FD6' },
  { value: 'zorg',             label: 'Zorg',             color: '#5FB0AC' },
  { value: 'zorg_detachering', label: 'Zorg-detachering', color: '#A98AD1' },
]

// Agreement type — the contract form the deal runs under.
export const DEFAULT_AGREEMENT_TYPES: LookupOption[] = [
  { value: 'cooperation', label: 'Samenwerkingsovereenkomst', color: '#6FA8C4' },
  { value: 'framework',   label: 'Mantelovereenkomst',        color: '#DDA071' },
]

// Generic tenant lookup with a seed fallback; a 404/empty keeps the seed.
function useLookup(url: string, seed: LookupOption[]) {
  const [items, setItems] = useState<LookupOption[]>(seed)
  useEffect(() => {
    api.get(url)
      .then(r => { const list = normalizeOptions(r.data?.data ?? r.data); if (list) setItems(list) })
      .catch(() => {})
  }, [url])
  // value(slug) → item, with a neutral fallback so the UI never crashes.
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
