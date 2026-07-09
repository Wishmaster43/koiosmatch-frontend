/**
 * useCao — tenant-configurable CAO (collective labour agreement) lookup, used to
 * scope a customer's price agreements (Settings → Klanten → CAO). Fed by GET /cao
 * ({ value, label, color, sort_order, in_use }, delivered 2026-07-08); a seed
 * fallback drives the picker until the endpoint responds (mirrors useNoteTypes /
 * useDocumentTypes — same SlugLookup shape as /contract-types).
 */
import { useState, useEffect } from 'react'
import api from './api'
import type { LookupOption } from '@/types/common'

// Seed defaults mirror the backend seed (healthcare CAOs); labels are tenant-facing.
export const DEFAULT_CAO: LookupOption[] = [
  { value: 'vvt', label: 'VVT' },
  { value: 'ziekenhuizen', label: 'Ziekenhuizen' },
  { value: 'ggz', label: 'GGZ' },
  { value: 'gehandicaptenzorg', label: 'Gehandicaptenzorg' },
  { value: 'jeugdzorg', label: 'Jeugdzorg' },
  { value: 'huisartsenzorg', label: 'Huisartsenzorg' },
]

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// Normalise an API row (value/label/color) to the UI LookupOption shape.
const toOption = (r: Record<string, unknown>): LookupOption => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.label ?? r.id ?? ''),
  label: String(r.label ?? r.name ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
})

export function useCao() {
  const [types, setTypes] = useState<LookupOption[]>(DEFAULT_CAO)

  // Load the tenant lookup once; keep the seed if the endpoint is empty/unavailable.
  useEffect(() => {
    let alive = true
    api.get('/cao').then(r => {
      const raw = (r?.data?.data ?? r?.data ?? []) as Record<string, unknown>[]
      const d = raw.filter(Boolean).map(toOption)
      if (alive && d.length) setTypes(d)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Resolve a stored value/slug to its label/colour; fall back to the raw value.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string | undefined => find(value)?.color

  return { types, labelOf, colorOf }
}
