/**
 * useProvinces — tenant-configurable province lookup (PROVINCES-1), CASCADED on
 * the candidate's own address `country` (COUNTRY-1, Danny addendum: "provincie
 * moet cascaderen op het gekozen land").
 *
 * Fed by the API (GET /provinces?country=XX, full CRUD + reorder landed BE-side),
 * already seeded per country (NL/BE/DE/FR/ES/GB/IE). `country` defaults to 'NL' so
 * every EXISTING caller (that doesn't pass one yet) sees exactly the old NL-only
 * behaviour — the fixed NL_PROVINCES list as a seed fallback while the API is
 * empty/unavailable (mirrors useNationalities). Items are plain name strings
 * (the candidate stores the province name).
 *
 * The country is embedded in the CACHE KEY itself (the request URL — same trick
 * as useNoteTypes' `?entity=` scoping) so switching country never shows the
 * PREVIOUS country's cached list: NL and BE each get their own cache slot.
 * A genuinely empty response (a country with no seeded provinces) is cached and
 * shown as an empty list — the calling field's own empty-state handles it, no
 * silent fallback to another country's data.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * country per session, shared across every mounted consumer of that country.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from '@/lib/useCachedLookup'
import { lookupNames } from '@/lib/lookupUtils'
import { NL_PROVINCES } from '../drawer/constants'

// Always the real (possibly empty) list — an empty response for a given country
// IS meaningful now (no seeded provinces there), unlike the old NL-only endpoint
// where empty meant "not seeded yet, keep the fallback".
const mapProvinces = (res: AxiosResponse): string[] => lookupNames(res)

export function useProvinces(country: string = 'NL') {
  const cc = (country || 'NL').toUpperCase()
  // NL keeps its hardcoded seed (pre-fetch / offline grace); any other country
  // starts empty rather than inventing data that was never real for it.
  const fallback = cc === 'NL' ? NL_PROVINCES : []
  const { data: provinces } = useCachedLookup(`/provinces?country=${cc}`, mapProvinces, fallback)
  return { provinces }
}
