/**
 * useGenders — tenant-configurable gender lookup with a colour per entry.
 *
 * Fed by the API (GET /genders → {value,label,color,...}) with a soft-palette
 * default as fallback while the API is empty/unavailable. Managed in Settings →
 * Geslacht. The colour drives the candidate avatar/icon in the list + drawer.
 *
 * Returns `colorOf(genderValue)` which matches on value OR label (case-insensitive)
 * so it works whether the candidate stores a slug ("male") or a label ("Man").
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer (the drawer-open "5× /genders" case).
 */
import { useCallback } from 'react'
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import type { LookupOption } from '@/types/common'

// Soft palette — matches the calm light/dark scheme used across lookups.
export const DEFAULT_GENDERS: LookupOption[] = [
  { value: 'male',   label: 'Man',     color: '#3B8FD4' },
  { value: 'female', label: 'Vrouw',   color: '#E06C9F' },
  { value: 'other',  label: 'Overig',  color: '#6FB98F' },
]

const norm = (s?: unknown) => (s ?? '').toString().trim().toLowerCase()

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapGenders = (res: AxiosResponse): LookupOption[] | null => {
  const d = ((res?.data?.data ?? res?.data ?? []) as LookupOption[]).filter(Boolean)
  return d.length ? d : null
}

export function useGenders() {
  const { data: genders } = useCachedLookup('/genders', mapGenders, DEFAULT_GENDERS)

  // value/label → colour (case-insensitive); null when unknown so callers can skip.
  // useCallback: CandidatesTable hangs this in its columns useMemo deps (audit item
  // 7) — it must only change identity when the underlying `genders` list changes.
  const colorOf = useCallback((gender?: string | null): string | null => {
    const g = norm(gender)
    if (!g) return null
    const hit = genders.find(x => norm(x.value) === g || norm(x.label) === g)
    return hit?.color ?? null
  }, [genders])

  return { genders, colorOf }
}
