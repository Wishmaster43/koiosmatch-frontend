/**
 * ContactDataTab — the "Gegevens" sub-tab body of ContactDetail: the field-table
 * card, the free-text block, the retention consent block and the location/
 * department (Vestiging) coupling. §0.3 split (mechanical extraction, no
 * behaviour change) — lifted verbatim out of ContactDetail.tsx, which was over
 * the ~400-line split trigger (§3), mirroring DepartmentDataTab/LocationAddressTab.
 * See ContactDetail's own docblock for the history of every comment kept below.
 */
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import ContactTextSection from './ContactTextSection'
import RetentionConsentBlock from '@/components/drawer/RetentionConsentBlock'
import ContactLinkSection from './ContactLinkSection'
import type { Contact, Department } from '@/types/customer'
import type { Id } from '@/types/common'

type Tx = (key: string, opts?: Record<string, unknown>) => string

// The "Gegevens" sub-tab: field-table card + free-text + retention consent + Vestiging coupling.
export default function ContactDataTab({
  contact, tableEpoch, fields, values, onSaveFields, editing, onStartEdit, onCancel,
  onSaveDescription, onToggleRetentionConsent,
  locations, departments, linkedLocationIds, linkedDepartmentIds, onLinkChange, t,
}: {
  contact: Contact
  tableEpoch: number
  fields: FieldRow[]
  values: Record<string, unknown>
  onSaveFields: (v: Record<string, unknown>) => void
  editing: boolean
  onStartEdit: () => void
  onCancel: () => void
  onSaveDescription: (html: string) => void
  onToggleRetentionConsent: (val: boolean) => void
  locations: { id: Id; name: string }[]
  departments: Department[]
  linkedLocationIds: Id[]
  linkedDepartmentIds: Id[]
  onLinkChange: (patch: { locationIds?: Id[]; departmentIds?: Id[] }) => void
  t: Tx
}) {
  return (
    <>
      {/* CANON-DIVIDER-1 (Danny 05-08): candidate ProfileTab canon — no line
          between rows, 11px labels. */}
      {/* Canon width (fieldRowCanon, 05-08): EditableFieldTable's own default now matches. */}
      <EditableFieldTable key={tableEpoch} title={t('contacts.detail.infoTitle')} fields={fields} value={values} onSave={onSaveFields}
        editing={editing} onStartEdit={onStartEdit} onCancel={onCancel} />

      {/* CONTACT-TEKST-1: the free-text block, canon-ordered directly under the
          field card and above the Vestiging (location/department) coupling. */}
      <ContactTextSection contactId={contact.id as Id} customerId={contact.customerId}
        value={contact.description ?? ''} onSave={onSaveDescription} />

      {/* CONTACT-CONSENT-AS-1 (K-262): retention consent block, added to the data
          tab as an additive section. Uses namespace='customers' and viewPermission=
          'customers.update' (the same gate as other edits on this contact). */}
      <RetentionConsentBlock
        optIn={contact.retentionConsent ?? false}
        consentAt={contact.retentionConsentAt ?? null}
        // RETENTION-CONSENT-BLANK-1 (Danny 08-09 B): the derived deadline renders the "bewaren tot" line; null = no line.
        expiresAt={contact.retentionExpiresAt ?? null}
        onToggle={onToggleRetentionConsent}
        namespace="customers"
        viewPermission="customers.update"
      />

      {/* Koppeling — same shape and behaviour as "+ Vestiging" (Danny 28-07). */}
      <ContactLinkSection locationIds={linkedLocationIds} departmentIds={linkedDepartmentIds}
        locations={locations} departments={departments} onChange={onLinkChange} />
    </>
  )
}
