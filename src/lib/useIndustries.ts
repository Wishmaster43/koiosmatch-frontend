/**
 * useIndustries — tenant-configurable industry list.
 *
 * Fed by the API (GET /industries) with a sensible package default as fallback
 * while the API is empty/unavailable. Managed in Settings → Personalisation →
 * Industries. Items are plain name strings (company stores the name).
 */
import { useState, useEffect } from 'react'
import api from './api'
import { lookupNames } from './lookupUtils'

export const DEFAULT_INDUSTRIES = [
  'Werving', 'Uitzendbureau', 'Horeca', 'Logistiek', 'Zorg',
  'IT', 'Bouw', 'Onderwijs', 'Financiën', 'Overig',
]

export function useIndustries() {
  const [industries, setIndustries] = useState<string[]>(DEFAULT_INDUSTRIES)

  // Override the default with the configured list once the API responds.
  useEffect(() => {
    api.get('/industries').then(r => { const d = lookupNames(r); if (d.length) setIndustries(d) }).catch(() => {})
  }, [])

  return { industries }
}
