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
