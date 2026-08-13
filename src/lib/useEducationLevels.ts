/**
 * useEducationLevels — tenant-configurable education-level lookup (KAND-NIVEAU-1,
 * e.g. "MBO-4", "HBO"), fed by GET /education-levels. `candidate_educations.level_id`
 * stores this BY ID (never by name — EducationLevel has no CascadesRename, so a
 * tenant rename must not orphan existing rows), so this hook keeps the real `id`
 * alongside the display name — mirrors useApplicationStages's identical id-
 * preserving shape (the shared LookupsContext-style hooks drop the id, which is
 * fine for a value/slug field but wrong for an id-referenced one like this).
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 *
 * LOOKUP-ICON-1 (batch 12, P22-30): the backend now carries an optional `icon`
 * per row (lucide slug or emoji, same convention as driver-licenses/last-contact-
 * types), so this hook keeps it alongside id/label/color. Consumers that never
 * cared about the icon (options built for a dropdown, e.g. `{value, label}`)
 * are unaffected — `icon` is purely additive on the returned object.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

export interface EducationLevelOption {
  id: string
  label: string
  color?: string
  icon?: string | null
}

// Seed defaults (Dutch education system) — ids fall back to the label (only
// meaningful once the real API responds; the seed is never actually submitted).
export const DEFAULT_EDUCATION_LEVELS: EducationLevelOption[] = [
  { id: 'VMBO', label: 'VMBO' },
  { id: 'MBO', label: 'MBO' },
  { id: 'HAVO', label: 'HAVO' },
  { id: 'VWO', label: 'VWO' },
  { id: 'HBO', label: 'HBO' },
  { id: 'WO', label: 'WO' },
]

// Normalise a raw /education-levels row ({id, name, color, icon, sort_order, active, in_use}).
const toLevel = (r: Record<string, unknown>): EducationLevelOption => ({
  id: String(r.id ?? ''),
  label: String(r.name ?? r.label ?? ''),
  color: (r.color as string) ?? undefined,
  icon: typeof r.icon === 'string' && r.icon ? r.icon : undefined,
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapLevels = (res: AxiosResponse): EducationLevelOption[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  const d = rows.filter(Boolean).map(toLevel).filter(l => l.id && l.label)
  return d.length ? d : null
}

export function useEducationLevels() {
  const { data: levels } = useCachedLookup('/education-levels', mapLevels, DEFAULT_EDUCATION_LEVELS)
  return { levels }
}
