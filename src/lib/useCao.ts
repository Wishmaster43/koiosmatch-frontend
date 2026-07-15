/**
 * useCao — tenant-configurable CAO (collective labour agreement) lookup, used to
 * scope a customer's price agreements (Settings → Klanten → CAO). Fed by GET /cao
 * ({ value, label, color, sort_order, in_use }, delivered 2026-07-08); a seed
 * fallback drives the picker until the endpoint responds (mirrors useNoteTypes /
 * useDocumentTypes — same SlugLookup shape as /contract-types).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
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

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapCao = (res: AxiosResponse): LookupOption[] | null => {
  const raw = (res?.data?.data ?? res?.data ?? []) as Record<string, unknown>[]
  const d = raw.filter(Boolean).map(toOption)
  return d.length ? d : null
}

export function useCao() {
  const { data: types } = useCachedLookup('/cao', mapCao, DEFAULT_CAO)

  // Resolve a stored value/slug to its label/colour; fall back to the raw value.
  const find = (value?: string | null) => {
    const v = norm(value)
    return v ? types.find(x => norm(x.value) === v || norm(x.label) === v) : undefined
  }
  const labelOf = (value?: string | null): string => find(value)?.label ?? value ?? ''
  const colorOf = (value?: string | null): string | undefined => find(value)?.color

  return { types, labelOf, colorOf }
}
