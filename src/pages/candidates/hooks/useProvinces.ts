/**
 * useProvinces — tenant-configurable Dutch-province lookup (PROVINCES-1).
 *
 * Fed by the API (GET /provinces, full CRUD + reorder landed BE-side) with the
 * fixed NL_PROVINCES list as a seed fallback while the API is empty/unavailable
 * (mirrors useNationalities). Items are plain name strings (the candidate stores
 * the province name).
 *
 * `/provinces` is a multi-country table (a live-check finding, kandidaten-
 * ronde-2 punt A: the unfiltered GET returned BE/DE/… provinces mixed in,
 * confusing to pick from and a React duplicate-key risk if two countries share
 * a province name) — the candidate's own province is Dutch (NL_PROVINCES was
 * "a fixed real-world list, not tenant-configurable" per constants.ts), so this
 * always asks the endpoint's own `country` filter for `NL` only, exactly
 * matching what the hardcoded list represented.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { lookupNames } from '@/lib/lookupUtils'
import { NL_PROVINCES } from '../drawer/constants'

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapProvinces = (res: AxiosResponse): string[] | null => {
  const d = lookupNames(res)
  return d.length ? d : null
}

export function useProvinces() {
  const { data: provinces } = useCachedLookup('/provinces', mapProvinces, NL_PROVINCES, { params: { country: 'NL' } })
  return { provinces }
}
