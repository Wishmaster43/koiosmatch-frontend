/**
 * useGenders — tenant-configurable gender lookup with a colour per entry.
 *
 * Fed by the API (GET /genders → {value,label,color,...}) with a soft-palette
 * default as fallback while the API is empty/unavailable. Managed in Settings →
 * Geslacht. The colour drives the candidate avatar/icon in the list + drawer.
 *
 * Returns `colorOf(genderValue)` which matches on value OR label (case-insensitive)
 * so it works whether the candidate stores a slug ("male") or a label ("Man").
 */
import { useState, useEffect } from 'react'
import api from './api'
import type { LookupOption } from '@/types/common'

// Soft palette — matches the calm light/dark scheme used across lookups.
export const DEFAULT_GENDERS: LookupOption[] = [
  { value: 'male',   label: 'Man',     color: '#3B8FD4' },
  { value: 'female', label: 'Vrouw',   color: '#E06C9F' },
  { value: 'other',  label: 'Overig',  color: '#6FB98F' },
]

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

export function useGenders() {
  const [genders, setGenders] = useState<LookupOption[]>(DEFAULT_GENDERS)

  useEffect(() => {
    api.get('/genders').then(r => {
      const d = ((r?.data?.data ?? r?.data ?? []) as LookupOption[]).filter(Boolean)
      if (d.length) setGenders(d)
    }).catch(() => {})
  }, [])

  // value/label → colour (case-insensitive); null when unknown so callers can skip.
  const colorOf = (gender?: string | null): string | null => {
    const g = norm(gender)
    if (!g) return null
    const hit = genders.find(x => norm(x.value) === g || norm(x.label) === g)
    return hit?.color ?? null
  }

  return { genders, colorOf }
}
