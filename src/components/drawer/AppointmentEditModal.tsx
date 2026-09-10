/**
 * AppointmentEditModal — the PlanIntakeModal edit block shared by the customer
 * and vacancy AppointmentsTab (DRY round 11, CUSTTABS2): renders nothing while
 * no row is being edited, otherwise the shared modal prefilled with the row.
 */
import { PlanIntakeModal } from '@/pages/candidates/shared'
import type { EditingAppointment } from '@/hooks/useAppointmentEditing'


interface AppointmentEditModalProps {
  editing: EditingAppointment | null
  onClose: () => void
  onSaved: () => void
}

// Wraps the shared PlanIntakeModal's edit mode — null while nothing is being edited.
export default function AppointmentEditModal({ editing, onClose, onSaved }: AppointmentEditModalProps) {
  if (!editing) return null
  return (
    <PlanIntakeModal candidateId={editing.candidateId} existing={editing.appt} mode="appointment"
      onClose={onClose} onCreated={onSaved} />
  )
}
