/**
 * useOutreachStatuses — tenant-configurable call-list ENTRY statuses (R-1b).
 *
 * Fed by GET /outreach-statuses ({value,label,color,is_reached}); seed fallback
 * mirrors the backend seed. The is_reached FLAG (never the slug) tells which
 * statuses stamp contacted_at — tenant-added statuses behave by their flag.
 * The FIRST status in the tenant order is the initial ("todo") state.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import { useCallback } from 'react'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'

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

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapOutreachStatuses = (res: AxiosResponse): OutreachStatus[] | null => {
  const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toStatus) : null
}

export function useOutreachStatuses() {
  const { data: statuses } = useCachedLookup('/outreach-statuses', mapOutreachStatuses, DEFAULT_OUTREACH_STATUSES, { quiet404: true })

  // Resolve a stored slug to its meta; tolerant of label-stored values.
  // useCallback: consumers hang this in memo/effect deps — it must be stable.
  const metaOf = useCallback((v?: string | null): OutreachStatus | undefined =>
    statuses.find(s => s.value === v || s.label === v), [statuses])
  // The initial ("todo") state = the first status in the tenant order.
  const initial = statuses[0]

  return { statuses, metaOf, initial }
}
