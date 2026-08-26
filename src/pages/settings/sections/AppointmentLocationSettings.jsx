/**
 * Appointment locations (LOOKUP-DEFAULT-1, api 4c25677) — tenant lookup behind
 * `appointments.appointment_location` (Kantoor/Online/Telefonisch/Bij klant —
 * "Office/Online/Phone/At customer", seeded
 * default = Kantoor, "Office"). Sits next to Appointment types (same "Matches"
 * settings group)
 * and reuses the same shared StatusListEditor — colour + drag-reorder + the
 * backend-enforced `is_default` singleton via DefaultToggle, nothing bespoke.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// Thin config wrapper around the shared StatusListEditor for the appointment-location lookup; colour, reorder and the default singleton all come from that shared editor (see file header).
export function AppointmentLocationSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor
        title={t('appointmentLocations.title')} subtitle={t('appointmentLocations.subtitle')}
        endpoint="/appointment-locations" addLabel={t('appointmentLocations.add')}
        defaultField={{ key: 'is_default' }} />
    </div>
  )
}
