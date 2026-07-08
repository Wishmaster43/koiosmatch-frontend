import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

/**
 * Appointment types (APPT-1) — tenant lookup behind "Intake plannen": each type
 * carries a default duration + modality + an is_intake flag, so picking a type
 * proposes the minutes and office/remote. Managed here; the recruiter overrides
 * per appointment. Reuses the shared StatusListEditor (colour + icon + reorder).
 */
export function AppointmentTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor withIcon
        title={t('appointmentTypes.title')} subtitle={t('appointmentTypes.subtitle')}
        endpoint="/appointment-types" addLabel={t('appointmentTypes.add')}
        numberField={{ key: 'default_duration_min', label: t('appointmentTypes.duration'), default: 30, min: 5, max: 480, suffix: 'min' }}
        extraField={{ key: 'default_modality', label: t('appointmentTypes.modality'), default: 'office',
          options: [
            { value: 'office', label: t('appointmentTypes.office') },
            { value: 'remote', label: t('appointmentTypes.remote') },
            { value: 'phone',  label: t('appointmentTypes.phone') },
          ] }}
        flagField={{ key: 'is_intake', label: t('appointmentTypes.isIntake'), description: t('appointmentTypes.isIntakeDesc') }} />
    </div>
  )
}
