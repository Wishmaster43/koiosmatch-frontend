/**
 * useIndustries — tenant-configurable industry list.
 *
 * Fed by the API (GET /industries) with a sensible package default as fallback
 * while the API is empty/unavailable. Managed in Settings → Personalisation →
 * Industries. Items are plain name strings (company stores the name).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_INDUSTRIES = [
  'Werving', 'Uitzendbureau', 'Horeca', 'Logistiek', 'Zorg',
  'IT', 'Bouw', 'Onderwijs', 'Financiën', 'Overig',
]

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapIndustries = (res: AxiosResponse): string[] | null => {
  const d = lookupNames(res)
  return d.length ? d : null
}

export function useIndustries() {
  const { data: industries } = useCachedLookup('/industries', mapIndustries, DEFAULT_INDUSTRIES)
  return { industries }
}
