/**
 * useNationalities — tenant-configurable nationality lookup.
 *
 * Fed by the API (GET /nationalities) with a Dutch-market default as fallback
 * while the API is empty/unavailable (CFG-1). Managed in Settings → Nationaliteiten.
 * Items are plain name strings (the candidate stores the name).
 */
import { useState, useEffect } from 'react'
import api from './api'
import { lookupNames } from './lookupUtils'

export const DEFAULT_NATIONALITIES = [
  'Nederlands', 'Belgisch', 'Duits', 'Frans', 'Brits', 'Pools', 'Turks',
  'Marokkaans', 'Surinaams', 'Antilliaans', 'Overig',
]

export function useNationalities() {
  const [nationalities, setNationalities] = useState<string[]>(DEFAULT_NATIONALITIES)

  // Override the default with the configured list once the API responds.
  useEffect(() => {
    api.get('/nationalities').then(r => {
      const d = lookupNames(r); if (d.length) setNationalities(d)
    }).catch(() => {})
  }, [])

  return { nationalities }
}
