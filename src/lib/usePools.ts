/**
 * usePools — tenant talent-pool lookup as a flat list of names.
 *
 * Fed by the API (GET /pools). Returns pool names for chip/option lists (e.g. the
 * planner). The candidate↔pool membership pivot lives in PoolsSection; this hook
 * only exposes the available pool names so nothing hardcodes the pool vocabulary.
 */
import { useState, useEffect } from 'react'
import api from './api'

export function usePools() {
  const [pools, setPools] = useState<string[]>([])

  // Load the tenant pools once; tolerate an empty/unavailable endpoint.
  useEffect(() => {
    api.get('/pools').then(r => {
      const raw = (r?.data?.data ?? r?.data ?? []) as Array<Record<string, unknown>>
      const names = raw.map(p => String(p.name ?? p.label ?? p.value ?? '')).filter(Boolean)
      if (names.length) setPools(names)
    }).catch(() => {})
  }, [])

  return { pools }
}
