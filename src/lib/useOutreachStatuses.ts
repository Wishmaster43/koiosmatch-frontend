/**
 * useOutreachStatuses — tenant-configurable call-list ENTRY statuses (R-1b).
 *
 * Fed by GET /outreach-statuses ({value,label,color,is_reached}); seed fallback
 * mirrors the backend seed. The is_reached FLAG (never the slug) tells which
 * statuses stamp contacted_at — tenant-added statuses behave by their flag.
 * The FIRST status in the tenant order is the initial ("todo") state.
 */
import { useState, useEffect } from 'react'
import api from './api'

export interface OutreachStatus { value: string; label: string; color?: string; is_reached: boolean }

export const DEFAULT_OUTREACH_STATUSES: OutreachStatus[] = [
  { value: 'todo',      label: 'Te doen',       color: '#94A3B8', is_reached: false },
  { value: 'contacted', label: 'Benaderd',      color: '#6E8FD6', is_reached: true },
  { value: 'answered',  label: 'Beantwoord',    color: '#79B58E', is_reached: true },
  { value: 'skipped',   label: 'Overgeslagen',  color: '#DDA071', is_reached: false },
]

// Normalise an API row to the UI shape (value/label tolerant, flag coerced).
const toStatus = (r: Record<string, unknown>): OutreachStatus => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
  is_reached: Boolean(r.is_reached),
})

export function useOutreachStatuses() {
  const [statuses, setStatuses] = useState<OutreachStatus[]>(DEFAULT_OUTREACH_STATUSES)

  // Load the tenant lookup once; keep the seed on failure (offline/older API).
  useEffect(() => {
    let alive = true
    api.get('/outreach-statuses', { quiet404: true })
      .then(res => {
        const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[]
        if (alive && Array.isArray(rows) && rows.length) setStatuses(rows.map(toStatus))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Resolve a stored slug to its meta; tolerant of label-stored values.
  const metaOf = (v?: string | null): OutreachStatus | undefined =>
    statuses.find(s => s.value === v || s.label === v)
  // The initial ("todo") state = the first status in the tenant order.
  const initial = statuses[0]

  return { statuses, metaOf, initial }
}
