/**
 * useMatchStatuses — tenant-configurable match lifecycle statuses (R-1b).
 *
 * Fed by GET /match-statuses ({value,label,color,is_closed}); seed fallback
 * mirrors the backend seed. The is_closed FLAG (never the slug) drives the
 * behaviour: a closed status ends the match (ended_at + out of the open count).
 */
import { useState, useEffect } from 'react'
import api from './api'

export interface MatchStatus { value: string; label: string; color?: string; is_closed: boolean }

export const DEFAULT_MATCH_STATUSES: MatchStatus[] = [
  { value: 'open',   label: 'Open',       color: '#6FA8C4', is_closed: false },
  { value: 'closed', label: 'Afgesloten', color: '#79B58E', is_closed: true },
]

// Normalise an API row to the UI shape (value/label tolerant, flag coerced).
const toStatus = (r: Record<string, unknown>): MatchStatus => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
  is_closed: Boolean(r.is_closed),
})

export function useMatchStatuses() {
  const [statuses, setStatuses] = useState<MatchStatus[]>(DEFAULT_MATCH_STATUSES)

  // Load the tenant lookup once; keep the seed on failure (offline/older API).
  useEffect(() => {
    let alive = true
    api.get('/match-statuses', { quiet404: true })
      .then(res => {
        const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[]
        if (alive && Array.isArray(rows) && rows.length) setStatuses(rows.map(toStatus))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Resolve a stored slug to its meta; tolerant of label-stored values.
  const metaOf = (v?: string | null): MatchStatus | undefined =>
    statuses.find(s => s.value === v || s.label === v)

  return { statuses, metaOf }
}
