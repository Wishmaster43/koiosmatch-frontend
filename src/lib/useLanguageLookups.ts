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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { lookupNames } from './lookupUtils'
import { translateSeedLabel } from './lookupSeedI18n'

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

// Tenant-configurable languages + proficiency levels, seed-labelled and cached
// (see file docblock above); a tenant-created value renders as typed, never translated.
export function useLanguageLookups() {
  const { t } = useTranslation('common')
  const { data: rawLanguages } = useCachedLookup('/languages', mapNames, DEFAULT_LANGUAGES)
  const { data: rawLevels }    = useCachedLookup('/language-levels', mapNames, DEFAULT_LANGUAGE_LEVELS)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  const languages = useMemo(
    () => rawLanguages.map(name => translateSeedLabel(t, 'languages', { label: name })),
    [rawLanguages, t],
  )
  // Same seed-label treatment as `languages` above, for the proficiency-level list.
  const levels = useMemo(
    () => rawLevels.map(name => translateSeedLabel(t, 'languageLevels', { label: name })),
    [rawLevels, t],
  )
  return { languages, levels }
}
