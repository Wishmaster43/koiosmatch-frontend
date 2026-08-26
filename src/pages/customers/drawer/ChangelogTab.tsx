/**
 * ChangelogTab — the customer's audit trail content (icon-popover, §3A(d)). Thin
 * wrapper around the shared `components/drawer/tabs/EntityChangelogTab` (§11
 * LANE-B): only the fetch and the sub-entity `subject_type` label are
 * customer-specific. Sub-entity rows (location/department/contact/document —
 * reached via `endpoint`) label themselves so a mixed customer+sub-entity feed
 * stays readable.
 */
import { useTranslation } from 'react-i18next'
import EntityChangelogTab from '@/components/drawer/tabs/EntityChangelogTab'
import { useCustomerActivity } from '../hooks/useCustomerActivity'
import type { Id } from '@/types/common'

// Recognised sub-entity `subject_type` class names → the i18n key naming them.
const SUBJECT_LABEL_KEYS: Record<string, string> = {
  CustomerLocation: 'location', CustomerDepartment: 'department', CustomerContact: 'contact', Document: 'document',
}

// Bookkeeping fields carry no user meaning — never show them as diff rows.
const NOISE_FIELDS = ['external_id', 'remember_token', 'password', 'uuid']

// The customer (or sub-entity, via `endpoint`) audit-trail content.
export default function ChangelogTab({ customerId, endpoint }: { customerId?: Id; endpoint?: string }) {
  const { t } = useTranslation('customers')
  const { items, loading, error } = useCustomerActivity({ customerId, endpoint })

  // The sub-entity label for a mixed feed (customer's own entries carry no
  // `subject_type`, or one that isn't in the known map — both render nothing).
  const subjectLabel = (ev: { subject_type?: string }): string | undefined => {
    const key = ev.subject_type ? SUBJECT_LABEL_KEYS[ev.subject_type] : undefined
    return key ? t(`changelog.subjectTypes.${key}`) : undefined
  }

  return (
    <EntityChangelogTab
      items={items} loading={loading} error={error} namespace="customers"
      noiseFields={NOISE_FIELDS} subjectLabel={subjectLabel} fallbackDescription
    />
  )
}
