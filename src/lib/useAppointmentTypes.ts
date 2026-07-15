/**
 * useAppointmentTypes — tenant-configurable appointment TYPES (Settings-managed).
 *
 * Each type carries a default duration + modality, so picking a type during
 * "Intake plannen" proposes the minutes (overridable in the popup) and the
 * office/remote default. Fed by GET /appointment-types once the backend ships it
 * (APPT-1); until then a seed fallback drives the presets (Flex 30 / Deta 45).
 * The `is_intake` flag marks which types are intakes — never hardcoded.
 *
 * Fetch/cache/dedupe lives in useCachedLookup (audit item 8) — one GET per
 * session, shared across every mounted consumer.
 */
import type { AxiosResponse } from 'axios'
import { useCachedLookup } from './useCachedLookup'
import { unwrapList } from '@/lib/api'

export type Modality = 'office' | 'remote' | 'phone'

export interface AppointmentType {
  value: string
  label: string
  color?: string
  icon?: string
  default_duration_min: number
  default_modality: Modality
  is_intake: boolean
}

// Seed defaults — mirror the intended backend seed; slugs stable, labels tenant-facing.
export const DEFAULT_APPOINTMENT_TYPES: AppointmentType[] = [
  { value: 'intake_flex', label: 'Intake Flex',       color: '#6E8FD6', icon: '📋', default_duration_min: 30, default_modality: 'office', is_intake: true },
  { value: 'intake_deta', label: 'Intake Detachering', color: '#8B5CF6', icon: '📋', default_duration_min: 45, default_modality: 'office', is_intake: true },
  { value: 'intake_online', label: 'Intake online',    color: '#19A5CA', icon: '💻', default_duration_min: 30, default_modality: 'remote', is_intake: true },
  { value: 'followup',    label: 'Vervolggesprek',     color: '#79B58E', icon: '🔁', default_duration_min: 30, default_modality: 'office', is_intake: false },
]

// Normalise an API row to the UI shape (defensive about field names + defaults).
const toType = (r: Record<string, unknown>): AppointmentType => ({
  value: String(r.value ?? r.slug ?? r.name ?? r.id ?? ''),
  label: String(r.name ?? r.label ?? r.value ?? ''),
  color: (r.color as string) ?? undefined,
  icon: (r.icon as string) ?? undefined,
  default_duration_min: Number(r.default_duration_min ?? r.duration_min ?? 30) || 30,
  default_modality: (r.default_modality as Modality) ?? 'office',
  is_intake: Boolean(r.is_intake),
})

// null = nothing usable in this response — useCachedLookup keeps the seed and retries next mount.
const mapAppointmentTypes = (res: AxiosResponse): AppointmentType[] | null => {
  const rows = (unwrapList(res).rows) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length ? rows.map(toType) : null
}

export function useAppointmentTypes() {
  // The endpoint now exists (item 11) — a real 404 should surface in the dev log again.
  const { data: types } = useCachedLookup('/appointment-types', mapAppointmentTypes, DEFAULT_APPOINTMENT_TYPES)

  // Resolve a stored slug to its meta; tolerant of label-stored values.
  const metaOf = (v?: string | null): AppointmentType | undefined =>
    types.find(x => x.value === v || x.label === v)
  // Only the intake types (for the intake picker).
  const intakeTypes = types.filter(x => x.is_intake)

  return { types, intakeTypes, metaOf }
}
