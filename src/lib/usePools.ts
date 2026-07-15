/**
 * usePools — tenant talent-pool lookup as a flat list of names.
 *
 * Fed by the API (GET /pools). Returns pool names for chip/option lists (e.g. the
 * planner). The candidate↔pool membership pivot lives in PoolsSection; this hook
 * only exposes the available pool names so nothing hardcodes the pool vocabulary.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

export interface PoolItem { id: string; name: string; color?: string | null }

interface PoolsLookupData { pools: string[]; poolItems: PoolItem[] }
const FALLBACK: PoolsLookupData = { pools: [], poolItems: [] }

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapPools = (res: AxiosResponse): PoolsLookupData | null => {
  const raw = (unwrapList(res).rows) as Array<Record<string, unknown>>
  const items = raw
    .map(p => ({ id: String(p.id ?? ''), name: String(p.name ?? p.label ?? p.value ?? ''), color: (p.color as string) ?? null }))
    .filter(p => p.id && p.name)
  return items.length ? { pools: items.map(p => p.name), poolItems: items } : null
}

export function usePools() {
  const { data } = useCachedLookup('/pools', mapPools, FALLBACK)
  return { pools: data.pools, poolItems: data.poolItems }
}
