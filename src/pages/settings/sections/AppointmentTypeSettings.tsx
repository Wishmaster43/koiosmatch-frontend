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
 * Audience split (rows 2/102, api CONTRACT-CHANGELOG "appointment types split by
 * audience"): `is_for_candidates`/`is_for_contacts` gate which subject a type can
 * be planned for (GET /appointment-types?audience=candidate|contact); rendered as
 * two independent behaviour flags through the same flagFields mechanism the funnel
 * stage editor uses for is_applicant/requires_appointment.
 */
export function AppointmentTypeSettings() {
  const { t } = useTranslation('settings')
  return (
    <div style={{ maxWidth: 640 }}>
      <StatusListEditor compact withColor withValueSlug
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
        flagFields={[
          { key: 'is_intake', label: t('appointmentTypes.isIntake'), description: t('appointmentTypes.isIntakeDesc') },
          { key: 'is_for_candidates', label: t('appointmentTypes.isForCandidates'), description: t('appointmentTypes.isForCandidatesDesc'), default: true },
          { key: 'is_for_contacts', label: t('appointmentTypes.isForContacts'), description: t('appointmentTypes.isForContactsDesc'), default: true },
        ]}
        defaultFields={[
          { field: 'is_default', labelKey: 'appointmentTypes.isDefault' },
          { field: 'is_default_for_application', labelKey: 'appointmentTypes.isDefaultForApplication' },
        ]} />
    </div>
  )
}
