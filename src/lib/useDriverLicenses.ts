/**
 * useDriverLicenses — tenant-configurable driving-licence categories.
 *
 * Fed by the API (GET /driver-licenses) with the Dutch categories as a fallback
 * while the API is empty/unavailable. Managed in Settings → Candidate → Driving
 * licences. Items are plain name strings (the candidate preference stores the set).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_DRIVER_LICENSES = ['AM', 'A', 'B', 'BE', 'C', 'C1', 'CE', 'D', 'D1', 'DE', 'T']

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapDriverLicenses = (res: AxiosResponse): string[] | null => {
  const d = lookupNames(res)
  return d.length ? d : null
}

export function useDriverLicenses() {
  const { data: licenses } = useCachedLookup('/driver-licenses', mapDriverLicenses, DEFAULT_DRIVER_LICENSES)
  return { licenses }
}
