/**
 * usePools — tenant talent-pool lookup as a flat list of names.
 *
 * Fed by the API (GET /pools). Returns pool names for chip/option lists (e.g. the
 * planner). The candidate↔pool membership pivot lives in PoolsSection; this hook
 * only exposes the available pool names so nothing hardcodes the pool vocabulary.
 */
import { useState, useEffect } from 'react'
import api from './api'

export interface PoolItem { id: string; name: string; color?: string | null }

export function usePools() {
  const [pools, setPools] = useState<string[]>([])
  // Full rows (id+name) — the pool FILTER needs ids (GET /candidates?pool[]=id); the
  // existing chip/option consumers keep the flat `pools` names.
  const [poolItems, setPoolItems] = useState<PoolItem[]>([])

  // Load the tenant pools once; tolerate an empty/unavailable endpoint.
  useEffect(() => {
    api.get('/pools').then(r => {
      const raw = (r?.data?.data ?? r?.data ?? []) as Array<Record<string, unknown>>
      const items = raw
        .map(p => ({ id: String(p.id ?? ''), name: String(p.name ?? p.label ?? p.value ?? ''), color: (p.color as string) ?? null }))
        .filter(p => p.id && p.name)
      if (items.length) { setPools(items.map(p => p.name)); setPoolItems(items) }
    }).catch(() => {})
  }, [])

  return { pools, poolItems }
}
