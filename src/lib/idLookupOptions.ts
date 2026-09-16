/**
 * idLookupOptions — the id-keyed {value,label} mapper shared by every tenant
 * lookup hook whose consumer filters on the lookup's raw uuid id rather than
 * its stable value/slug (reportStatusLookups.ts's vacancy/task status+type+
 * priority options, the KPI-builder's task-type dimension values). Extracted
 * once both call sites needed the exact same row → option shape, so the
 * mapping logic has one definition instead of two hand-copies drifting apart.
 */
import type { AxiosResponse } from 'axios'
import { unwrapList } from '@/lib/api'

export interface IdLabelOption { value: string; label: string }

// Maps a raw lookup row (id + label/name/value) to {value: id, label}; null
// when the response carries nothing usable (useCachedLookup keeps the seed).
export function mapIdLabelOptions(res: AxiosResponse): IdLabelOption[] | null {
  const rows = unwrapList(res).rows as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length
    ? rows.map(r => ({ value: String(r.id ?? ''), label: String(r.label ?? r.name ?? r.value ?? '') }))
    : null
}
