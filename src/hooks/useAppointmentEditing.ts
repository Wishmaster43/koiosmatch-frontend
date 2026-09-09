/**
 * useAppointmentEditing — shared appointment editing state + reload + transform
 * logic for both customers and vacancies AppointmentsTab.
 */
import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ExistingAppointment } from '@/pages/candidates/shared'
import type { VacancyAppointmentRow } from '@/types/vacancyAppointment'
import type { Id } from '@/types/common'

interface EditingAppointment { candidateId: Id; appt: ExistingAppointment }

interface UseAppointmentEditingProps {
  /** React-query key array for the appointments list (e.g., ['vacancies', vacancyId, 'appointments'] or ['customers', customerId, 'appointments']). */
  queryKey: (string | number | null | undefined)[]
  /** Optional extra fields to include in the transformed appointment (e.g., { vacancy_id } for vacancy contexts). */
  extra?: Partial<ExistingAppointment>
}

interface UseAppointmentEditingResult {
  editing: EditingAppointment | null
  setEditing: (state: EditingAppointment | null) => void
  reload: () => void
  toExisting: (a: VacancyAppointmentRow) => ExistingAppointment
}

export function useAppointmentEditing({
  queryKey,
  extra,
}: UseAppointmentEditingProps): UseAppointmentEditingResult {
  const [editing, setEditing] = useState<EditingAppointment | null>(null)
  const queryClient = useQueryClient()

  // Re-fetch the appointments list after create/edit — partial key match invalidates every cached page.
  const reload = () => queryClient.invalidateQueries({ queryKey })

  // Transform a stored row to the shape PlanIntakeModal expects, with optional extra fields.
  const toExisting = useCallback((a: VacancyAppointmentRow): ExistingAppointment => ({
    id: a.id,
    scheduled_at: a.scheduledAt ?? undefined,
    duration_min: a.durationMin,
    modality: a.modality ?? undefined,
    owner_id: a.ownerId ?? undefined,
    type: a.type ?? undefined,
    location_id: a.locationId,
    appointment_location: a.appointmentLocation,
    ...extra,
  }), [extra])

  return {
    editing,
    setEditing,
    reload,
    toExisting,
  }
}
