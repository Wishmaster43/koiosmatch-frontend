/**
 * Customer-domain lookups settings — the tenant-configurable statuses for the
 * customer entity and its sub-entities (locations, departments, contacts). Each is
 * CRUD + drag-reorder + in-use protection (409) via the shared StatusListEditor,
 * against /settings/customer-lookups/*. Mirrors the candidate/vacancy lookups.
 */
import { useTranslation } from 'react-i18next'
import StatusListEditor from './StatusListEditor'

// Customer status lifecycle (single value per customer, drives the soft status chip).
export function CustomerStatusesSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('customerLookups.statuses.title')}
      subtitle={t('customerLookups.statuses.subtitle')}
      endpoint="/settings/customer-lookups/statuses"
      addLabel={t('customerLookups.statuses.add')}
    />
  )
}

// KLANT-FASE-1 — customer LIFECYCLE PHASE (Prospect → Klant), the counterpart of the
// candidate phase axis and a different question than the status above. CRUD + colour +
// drag-reorder + in-use 409 against /customer-phases (SlugLookupController).
// `is_customer` is the BEHAVIOUR FLAG the app binds on (the counterpart of the
// candidate's is_applicant) so a tenant may rename "Klant" freely; `is_default` is the
// backend-enforced singleton marking the phase a new customer starts in.
// withValueSlug: this endpoint requires the immutable `value` slug on create.
export function CustomerPhasesSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('customerLookups.phases.title')}
      subtitle={t('customerLookups.phases.subtitle')}
      endpoint="/customer-phases"
      addLabel={t('customerLookups.phases.add')}
      withValueSlug
      flagField={{ key: 'is_customer', label: t('customerLookups.phases.isCustomer'), description: t('customerLookups.phases.isCustomerHint') }}
      defaultField={{ key: 'is_default' }}
    />
  )
}

// Location status (single value per customer location).
export function LocationStatusesSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('customerLookups.locationStatuses.title')}
      subtitle={t('customerLookups.locationStatuses.subtitle')}
      endpoint="/settings/customer-lookups/location-statuses"
      addLabel={t('customerLookups.locationStatuses.add')}
    />
  )
}

// Department status (single value per department).
export function DepartmentStatusesSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('customerLookups.departmentStatuses.title')}
      subtitle={t('customerLookups.departmentStatuses.subtitle')}
      endpoint="/settings/customer-lookups/department-statuses"
      addLabel={t('customerLookups.departmentStatuses.add')}
    />
  )
}

// Contact-person status (single value per customer contact).
export function ContactStatusesSettings() {
  const { t } = useTranslation('settings')
  return (
    <StatusListEditor
      title={t('customerLookups.contactStatuses.title')}
      subtitle={t('customerLookups.contactStatuses.subtitle')}
      endpoint="/settings/customer-lookups/contact-statuses"
      addLabel={t('customerLookups.contactStatuses.add')}
    />
  )
}
