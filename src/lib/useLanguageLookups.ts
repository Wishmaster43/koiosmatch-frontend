/**
 * useLanguageLookups — tenant-configurable language list + proficiency levels.
 *
 * Fed by the API (GET /languages, GET /language-levels) with a sensible package
 * default as fallback while the API is empty/unavailable. Both are managed in
 * Settings → Talen. Items are plain name strings (the candidate stores the name).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per URL
 * per session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'

export const DEFAULT_LANGUAGES = [
  'Nederlands', 'Engels', 'Duits', 'Frans', 'Spaans', 'Pools', 'Turks',
  'Arabisch', 'Papiaments', 'Portugees', 'Italiaans', 'Roemeens', 'Oekraïens',
]

// "slecht → zeer goed" + Moedertaal (sluit aan op bestaande data).
export const DEFAULT_LANGUAGE_LEVELS = ['Slecht', 'Matig', 'Goed', 'Zeer goed', 'Moedertaal']

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapNames = (res: AxiosResponse): string[] | null => {
  const d = lookupNames(res)
  return d.length ? d : null
}

export function useLanguageLookups() {
  const { data: languages } = useCachedLookup('/languages', mapNames, DEFAULT_LANGUAGES)
  const { data: levels }    = useCachedLookup('/language-levels', mapNames, DEFAULT_LANGUAGE_LEVELS)
  return { languages, levels }
}
