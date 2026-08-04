import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'
import { resolveGenericLookupIcon } from './lookupIcons'

// Curated icon subset for appointment types — the generic set narrowed to the
// modalities/venues this lookup actually represents.
const APPOINTMENT_TYPE_ICON_NAMES = ['calendar', 'phone', 'video', 'map-pin', 'building', 'users']

/**
 * Appointment types (APPT-1) — tenant lookup behind "Intake plannen": each type
 * carries a default duration + modality + an is_intake flag, so picking a type
 * proposes the minutes and office/remote. Managed here; the recruiter overrides
 * per appointment. Reuses the shared StatusListEditor (colour + icon + reorder).
 * Two independent singleton flags (defaultFields, DEFAULT-UNDO 04-08):
 * `is_default` (LOOKUP-DEFAULT-1, api 4c25677) is the general default appointment
 * type, and `is_default_for_application` (AppointmentType.php:23/28/30,
 * AppointmentTypeController.php:34) is the default used specifically when planning
 * an intake from an application context — both are backend-enforced singletons,
 * each with its own pill so flipping one never touches the other.
 */
export function AppointmentTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor
        iconPicker={{ icons: APPOINTMENT_TYPE_ICON_NAMES, resolve: resolveGenericLookupIcon }}
        title={t('appointmentTypes.title')} subtitle={t('appointmentTypes.subtitle')}
        endpoint="/appointment-types" addLabel={t('appointmentTypes.add')}
        numberField={{ key: 'default_duration_min', label: t('appointmentTypes.duration'), default: 30, min: 5, max: 480, suffix: 'min' }}
        extraField={{ key: 'default_modality', label: t('appointmentTypes.modality'), default: 'office',
          options: [
            { value: 'office', label: t('appointmentTypes.office') },
            { value: 'remote', label: t('appointmentTypes.remote') },
            { value: 'phone',  label: t('appointmentTypes.phone') },
          ] }}
        flagField={{ key: 'is_intake', label: t('appointmentTypes.isIntake'), description: t('appointmentTypes.isIntakeDesc') }}
        defaultFields={[
          { field: 'is_default', labelKey: 'appointmentTypes.isDefault' },
          { field: 'is_default_for_application', labelKey: 'appointmentTypes.isDefaultForApplication' },
        ]} />
    </div>
  )
}
