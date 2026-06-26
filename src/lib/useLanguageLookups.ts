/**
 * useLanguageLookups — tenant-configurable language list + proficiency levels.
 *
 * Fed by the API (GET /languages, GET /language-levels) with a sensible package
 * default as fallback while the API is empty/unavailable. Both are managed in
 * Settings → Talen. Items are plain name strings (the candidate stores the name).
 */
import { useState, useEffect } from 'react'
import api from './api'
import { lookupNames } from './lookupUtils'

export const DEFAULT_LANGUAGES = [
  'Nederlands', 'Engels', 'Duits', 'Frans', 'Spaans', 'Pools', 'Turks',
  'Arabisch', 'Papiaments', 'Portugees', 'Italiaans', 'Roemeens', 'Oekraïens',
]

// "slecht → zeer goed" + Moedertaal (sluit aan op bestaande data).
export const DEFAULT_LANGUAGE_LEVELS = ['Slecht', 'Matig', 'Goed', 'Zeer goed', 'Moedertaal']

export function useLanguageLookups() {
  const [languages, setLanguages] = useState<string[]>(DEFAULT_LANGUAGES)
  const [levels,    setLevels]    = useState<string[]>(DEFAULT_LANGUAGE_LEVELS)

  useEffect(() => {
    api.get('/languages').then(r => { const d = lookupNames(r); if (d.length) setLanguages(d) }).catch(() => {})
    api.get('/language-levels').then(r => { const d = lookupNames(r); if (d.length) setLevels(d) }).catch(() => {})
  }, [])

  return { languages, levels }
}
