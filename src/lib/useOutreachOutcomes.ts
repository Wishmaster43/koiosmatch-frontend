/**
 * useOutreachOutcomes — tenant-configurable call-list outcome lookup (OUTREACH-2).
 *
 * Fed by the API (GET /outreach-outcomes → {value/name,label,color}) with a seed
 * default as fallback until the endpoint lands. VALUES are the API slugs (§3B —
 * never Dutch labels as values); labels are display-only defaults. Colours are
 * semantic tokens so the soft-chips follow the tenant theme (§4).
 */
import { useState, useEffect } from 'react'
import api from './api'
import type { LookupOption } from '@/types/common'

export const DEFAULT_OUTREACH_OUTCOMES: LookupOption[] = [
  { value: 'no_answer',      label: 'Geen gehoor',    color: 'var(--color-warning)' },
  { value: 'callback',       label: 'Terugbellen',    color: 'var(--color-primary)' },
  { value: 'not_interested', label: 'Geen interesse', color: 'var(--color-danger)' },
  { value: 'interested',     label: 'Interesse',      color: 'var(--color-success)' },
]

// Normalise an API row (id/name/label/value/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
})

export function useOutreachOutcomes() {
  const [outcomes, setOutcomes] = useState<LookupOption[]>(DEFAULT_OUTREACH_OUTCOMES)

  // Load the tenant lookup once; keep the seed while the endpoint is missing
  // (quiet404: the endpoint is optional until OUTREACH-2 lands backend-side).
  useEffect(() => {
    let alive = true
    api.get('/outreach-outcomes', { quiet404: true })
      .then(res => {
        const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[]
        if (alive && Array.isArray(rows) && rows.length) setOutcomes(rows.map(toOption))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Resolve a stored slug to its meta (label + colour) — tolerant of label-stored values.
  const metaOf = (v?: string | null): LookupOption | undefined =>
    outcomes.find(o => o.value === v || o.label === v)

  return { outcomes, metaOf }
}
