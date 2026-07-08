/**
 * useAppointmentTypes — tenant-configurable appointment TYPES (Settings-managed).
 *
 * Each type carries a default duration + modality, so picking a type during
 * "Intake plannen" proposes the minutes (overridable in the popup) and the
 * office/remote default. Fed by GET /appointment-types once the backend ships it
 * (APPT-1); until then a seed fallback drives the presets (Flex 30 / Deta 45).
 * The `is_intake` flag marks which types are intakes — never hardcoded.
 */
import { useState, useEffect } from 'react'
import api from './api'

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

export function useAppointmentTypes() {
  const [types, setTypes] = useState<AppointmentType[]>(DEFAULT_APPOINTMENT_TYPES)

  // Load the tenant lookup once; keep the seed while the endpoint is missing.
  useEffect(() => {
    let alive = true
    api.get('/appointment-types', { quiet404: true })
      .then(res => {
        const rows = (res.data?.data ?? res.data ?? []) as Record<string, unknown>[]
        if (alive && Array.isArray(rows) && rows.length) setTypes(rows.map(toType))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Resolve a stored slug to its meta; tolerant of label-stored values.
  const metaOf = (v?: string | null): AppointmentType | undefined =>
    types.find(x => x.value === v || x.label === v)
  // Only the intake types (for the intake picker).
  const intakeTypes = types.filter(x => x.is_intake)

  return { types, intakeTypes, metaOf }
}
