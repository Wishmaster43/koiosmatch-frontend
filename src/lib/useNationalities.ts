/**
 * useNationalities — tenant-configurable nationality lookup.
 *
 * Fed by the API (GET /nationalities) with a Dutch-market default as fallback
 * while the API is empty/unavailable (CFG-1). Managed in Settings → Nationaliteiten.
 * Items are plain name strings (the candidate stores the name).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_NATIONALITIES = [
  'Nederlands', 'Belgisch', 'Duits', 'Frans', 'Brits', 'Pools', 'Turks',
  'Marokkaans', 'Surinaams', 'Antilliaans', 'Overig',
]

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapNationalities = (res: AxiosResponse): string[] | null => {
  const d = lookupNames(res)
  return d.length ? d : null
}

export function useNationalities() {
  const { data: nationalities } = useCachedLookup('/nationalities', mapNationalities, DEFAULT_NATIONALITIES)
  return { nationalities }
}
