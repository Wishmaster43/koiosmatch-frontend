/**
 * useIndustries — tenant-configurable industry list.
 *
 * Fed by the API (GET /industries) with a sensible package default as fallback
 * while the API is empty/unavailable. Managed in Settings → Personalisation →
 * Industries. Items are plain name strings (company stores the name).
 */
import { useState, useEffect } from 'react'
import api from './api'

export const DEFAULT_INDUSTRIES = [
  'Werving', 'Uitzendbureau', 'Horeca', 'Logistiek', 'Zorg',
  'IT', 'Bouw', 'Onderwijs', 'Financiën', 'Overig',
]

// Normalise the API rows (string | {name|label|value}) to plain name strings.
const names = (res) => (res?.data?.data ?? res?.data ?? [])
  .map(x => (typeof x === 'string' ? x : (x.name ?? x.label ?? x.value)))
  .filter(Boolean)

export function useIndustries() {
  const [industries, setIndustries] = useState(DEFAULT_INDUSTRIES)

  // Override the default with the configured list once the API responds.
  useEffect(() => {
    api.get('/industries').then(r => { const d = names(r); if (d.length) setIndustries(d) }).catch(() => {})
  }, [])

  return { industries }
}
