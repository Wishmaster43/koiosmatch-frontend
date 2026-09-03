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
// Values are `class_basename()` of the backend model (LogsEntityActivity::formatActivityEntry) —
// CustomerDocument, not the bare "Document" this map used to carry, which meant a
// document write's chip silently never rendered (K-ACTLOG-ROLLUP-1, 04-09).
const SUBJECT_LABEL_KEYS: Record<string, string> = {
  CustomerLocation: 'location', CustomerDepartment: 'department', CustomerContact: 'contact', CustomerDocument: 'document',
}

// Bookkeeping fields carry no user meaning — never show them as diff rows.
const NOISE_FIELDS = ['external_id', 'remember_token', 'password', 'uuid']

interface ChangelogTabProps {
  customerId?: Id
  endpoint?: string
  // K-ACTLOG-SUBJECT-NAME-1: sub-entity id → name lookups, one per recognised type.
  // The caller (CustomerDrawer) already holds the live locations/departments/
  // contacts lists for its own CRUD tabs, so the rolled-up chip can name the
  // exact record ("Vestiging · Eindhoven"), not only its type. An id missing
  // from its map (or no map at all — e.g. documents) falls back to the type label.
  locationNames?: Record<string, string>
  departmentNames?: Record<string, string>
  contactNames?: Record<string, string>
}

// The customer (or sub-entity, via `endpoint`) audit-trail content.
export default function ChangelogTab({ customerId, endpoint, locationNames, departmentNames, contactNames }: ChangelogTabProps) {
  const { t } = useTranslation('customers')
  const { items, loading, error } = useCustomerActivity({ customerId, endpoint })
  const nameMaps: Record<string, Record<string, string> | undefined> = {
    location: locationNames, department: departmentNames, contact: contactNames,
  }

  // The sub-entity chip for a mixed feed: the type label alone, or "<type label> ·
  // <name>" once the entry's subject_id resolves in the matching id→name map
  // (customer's own entries carry no `subject_type`, or one that isn't in the
  // known map — both render nothing).
  const subjectLabel = (ev: { subject_type?: string; subject_id?: Id }): string | undefined => {
    const key = ev.subject_type ? SUBJECT_LABEL_KEYS[ev.subject_type] : undefined
    if (!key) return undefined
    const typeLabel = t(`changelog.subjectTypes.${key}`)
    const name = ev.subject_id !== undefined ? nameMaps[key]?.[String(ev.subject_id)] : undefined
    return name ? `${typeLabel} · ${name}` : typeLabel
  }

  return (
    <EntityChangelogTab
      items={items} loading={loading} error={error} namespace="customers"
      noiseFields={NOISE_FIELDS} subjectLabel={subjectLabel} fallbackDescription
    />
  )
}
