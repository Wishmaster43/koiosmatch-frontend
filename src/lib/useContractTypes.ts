/**
 * useContractTypes — tenant-configurable contract types for a match/placement
 * (Settings → Matches). NBBU/ABU fasen differ per bureau, so it is a tenant lookup,
 * never hardcoded. Fed by GET /contract-types once the backend ships it
 * (MATCH-PLACEMENT-1); a seed fallback drives the dropdown until then.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'

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

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapContractTypes = (res: AxiosResponse): string[] | null => {
  const rows = (res.data?.data ?? res.data ?? []) as Array<string | { name?: string; label?: string; value?: string }>
  const names = rows.map(x => typeof x === 'string' ? x : (x.name ?? x.label ?? x.value ?? '')).filter(Boolean) as string[]
  return names.length ? names : null
}

export function useContractTypes() {
  const { data: types } = useCachedLookup('/contract-types', mapContractTypes, DEFAULT_CONTRACT_TYPES, { quiet404: true })
  return { types }
}
