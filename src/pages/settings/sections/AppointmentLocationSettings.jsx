import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Appointment locations (LOOKUP-DEFAULT-1, api 4c25677) — tenant lookup behind
 * `appointments.appointment_location` (Kantoor/Online/Telefonisch/Bij klant, seeded
 * default = Kantoor). Sits next to Appointment types (same "Matches" settings group)
 * and reuses the same shared StatusListEditor — colour + drag-reorder + the
 * backend-enforced `is_default` singleton via DefaultToggle, nothing bespoke.
 */
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
