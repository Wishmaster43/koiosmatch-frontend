/**
 * useContractTypes — tenant-configurable contract types for a match/placement
 * (Settings → Matches). NBBU/ABU fasen differ per bureau, so it is a tenant lookup,
 * never hardcoded. Fed by GET /contract-types once the backend ships it
 * (MATCH-PLACEMENT-1); a seed fallback drives the dropdown until then.
 */
import { useState, useEffect } from 'react'
import api from './api'

// Seed defaults mirror Danny's spec (ABU + ZZP + W&S); labels tenant-facing.
export const DEFAULT_CONTRACT_TYPES = [
  'Fase 1-2 z.u.b. (Works)',
  'Fase 1-2 m.u.b. (Works)',
  'Fase 3 bepaalde tijd (Zorg)',
  'Fase 4 onbepaalde tijd',
  'ZZP Flex',
  'ZZP Project',
  'Werving & Selectie',
]

export function useContractTypes() {
  const [types, setTypes] = useState<string[]>(DEFAULT_CONTRACT_TYPES)

  // Load the tenant lookup once; keep the seed while the endpoint is missing.
  useEffect(() => {
    let alive = true
    api.get('/contract-types', { quiet404: true })
      .then(r => {
        const rows = (r.data?.data ?? r.data ?? []) as Array<string | { name?: string; label?: string; value?: string }>
        const names = rows.map(x => typeof x === 'string' ? x : (x.name ?? x.label ?? x.value ?? '')).filter(Boolean)
        if (alive && names.length) setTypes(names as string[])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return { types }
}
