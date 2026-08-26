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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { translateSeedList } from './lookupSeedI18n'
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

// Tenant pool lookup: flat translated names for chip/option lists plus the full
// items (id + colour) for consumers that need more than a label.
export function usePools() {
  const { t } = useTranslation('common')
  const { data } = useCachedLookup('/pools', mapPools, FALLBACK)
  // Seeded defaults render in the user language; a tenant value stays as typed (LOOKUP-I18N-1).
  // PoolItem carries `name` (not `label`), so translate through a {label} shim and zip it back.
  const poolItems = useMemo(() => {
    const translated = translateSeedList(t, 'pools', data.poolItems.map(p => ({ label: p.name })))
    return data.poolItems.map((p, i) => (translated[i].label === p.name ? p : { ...p, name: translated[i].label }))
  }, [data.poolItems, t])
  // Flat name list derived from the already-translated poolItems above, for simple chip/option consumers.
  const pools = useMemo(() => poolItems.map(p => p.name), [poolItems])
  return { pools, poolItems }
}
