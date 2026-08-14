/**
 * Vacancy appointments (AFSPRAKEN-VACATURE-1) — GET /vacancies/{vacancy}/appointments.
 * Fields mirror `App\Http\Resources\Appointment\AppointmentResource::toArray()`
 * verified live in koiosmatch-api (2026-08-14): every field below is emitted by
 * the backend today, nothing here is guessed.
 */
import type { Id } from './common'

// Raw shape as the API sends it (snake_case, owner is a nested {id,name} object).
export interface RawVacancyAppointment {
  id: Id
  candidate_id: Id | null
  candidate_name: string | null
  application_id: Id | null
  customer_id: Id | null
  customer_name: string | null
  customer_location_id: Id | null
  customer_location_name: string | null
  customer_department_id: Id | null
  customer_department_name: string | null
  contact_id: Id | null
  contact_name: string | null
  type: string | null
  scheduled_at: string | null
  duration_min: number | null
  modality: string | null
  appointment_location: string | null
  owner: { id: Id; name: string } | null
  location_id: Id | null
  location_name: string | null
  status: string | null
  is_overdue: boolean
  source: string | null
  outcome: string | null
  notes: string | null
}

// Mapped shape the tab renders (camelCase).
export interface VacancyAppointmentRow {
  id: Id
  candidateId: Id | null
  candidateName: string | null
  applicationId: Id | null
  customerId: Id | null
  customerName: string | null
  customerLocationId: Id | null
  customerLocationName: string | null
  customerDepartmentId: Id | null
  customerDepartmentName: string | null
  contactId: Id | null
  contactName: string | null
  type: string | null
  scheduledAt: string | null
  durationMin: number | null
  modality: string | null
  appointmentLocation: string | null
  ownerId: Id | null
  ownerName: string | null
  locationId: Id | null
  locationName: string | null
  status: string | null
  isOverdue: boolean
  source: string | null
  outcome: string | null
  notes: string | null
}

// Raw → mapped: one place, so a backend field rename surfaces here, not scattered in JSX.
export function mapVacancyAppointment(raw: RawVacancyAppointment): VacancyAppointmentRow {
  return {
    id: raw.id,
    candidateId: raw.candidate_id,
    candidateName: raw.candidate_name,
    applicationId: raw.application_id,
    customerId: raw.customer_id,
    customerName: raw.customer_name,
    customerLocationId: raw.customer_location_id,
    customerLocationName: raw.customer_location_name,
    customerDepartmentId: raw.customer_department_id,
    customerDepartmentName: raw.customer_department_name,
    contactId: raw.contact_id,
    contactName: raw.contact_name,
    type: raw.type,
    scheduledAt: raw.scheduled_at,
    durationMin: raw.duration_min,
    modality: raw.modality,
    appointmentLocation: raw.appointment_location,
    ownerId: raw.owner?.id ?? null,
    ownerName: raw.owner?.name ?? null,
    locationId: raw.location_id,
    locationName: raw.location_name,
    status: raw.status,
    isOverdue: !!raw.is_overdue,
    source: raw.source,
    outcome: raw.outcome,
    notes: raw.notes,
  }
}
