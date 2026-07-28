/**
 * planIntake/helpers — the render-free, dependency-free bits of the appointment
 * modal: the 422 field-key map, the recruiter display name and the two date
 * computations (default start time + live end time). Split out of
 * PlanIntakeModal.tsx (406 lines) because none of it touches React: keeping it
 * here lets the date maths be unit-tested directly (PlanIntakeModal.test.tsx
 * imports `endTimeOf`) and keeps usePlanIntakeForm to state + effects only.
 * Mirrors the sibling matchPlacement/helpers.ts.
 */
import type { Id } from '@/types/common'

// 422 field-error keys are snake_case; map them back to this form's field names.
export const API_TO_FORM: Record<string, string> = {
  scheduled_at: 'when', type: 'type', duration_min: 'duration', modality: 'modality',
  location_id: 'locationId', appointment_location: 'appointmentLocation',
  owner_id: 'ownerId', vacancy_id: 'vacancyId', application_id: 'applicationId',
}

export interface UserLike { id?: Id; name?: string; firstname?: string; lastname?: string; email?: string }
export const userName = (u: UserLike) => u.name || [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email || '—'

// Today, rounded UP to the next quarter hour, as a datetime-local value (YYYY-MM-DDTHH:MM).
export function defaultWhen(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  const q = 15 - (d.getMinutes() % 15)
  if (q !== 15) d.setMinutes(d.getMinutes() + q)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// S24a(b): the appointment's end time, computed live from `when` + `duration` — shown
// next to Duur so the recruiter sees "tot 22:15" without doing the maths themselves.
// Exported (not just used internally) so the date maths gets a direct unit test
// instead of only an indirect one through i18next's untranslated-key fallback.
export function endTimeOf(whenLocal: string, durationMin: number): string {
  if (!whenLocal) return ''
  const d = new Date(whenLocal)
  if (Number.isNaN(d.getTime())) return ''
  d.setMinutes(d.getMinutes() + (durationMin || 0))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
