/**
 * ContactDetail — the Contactpersonen-tab drill-down. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, function, email,
 * phone, status, primary toggle, and the location/department coupling.
 *
 * CONTACT-MULTI-1: the backend supports only ONE location + ONE department per
 * contact (customer_location_id / customer_department_id). Danny wants multi
 * eventually, so the coupling renders as `chip-select` — a single-value soft-chip
 * picker (not a plain <select>) — so flipping to multi later is a prop change on
 * EditableFieldTable, not a rebuild. Never silently drop a second value; there is
 * nowhere on the backend to put it yet (filed as a BE gap in the delivery report).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

export default function ContactDetail({ contact, locations, departments, statuses, onSave, onDelete, close }: {
  contact: Contact
  locations: { id: Id; name: string }[]
  departments: Department[]
  statuses: LookupOption[]
  onSave: (id: Id, payload: Partial<ContactPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  const [editing, setEditing] = useState(false)

  const fields: FieldRow[] = [
    { key: 'firstName', label: t('subModal.firstName'), type: 'text' },
    { key: 'lastName', label: t('subModal.lastName'), type: 'text' },
    { key: 'role', label: t('contacts.detail.role'), type: 'text' },
    { key: 'email', label: t('contacts.detail.email'), type: 'text' },
    { key: 'phone', label: t('contacts.detail.phone'), type: 'text' },
    { key: 'statusId', label: t('locations.detail.status'), type: 'select', options: statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })) },
    // Single-value coupling, chip UI (CONTACT-MULTI-1 — see file header).
    { key: 'locationId', label: t('contacts.detail.location'), type: 'chip-select',
      chipOptions: locations.map(l => ({ value: String(l.id), label: l.name })), emptyOptionsText: t('locations.detail.none') },
    { key: 'departmentId', label: t('contacts.detail.department'), type: 'chip-select',
      chipOptions: departments.map(d => ({ value: String(d.id), label: d.name })), emptyOptionsText: t('locations.detail.none') },
    { key: 'isPrimary', label: t('contacts.detail.primary'), type: 'checkbox' },
  ]

  const values = {
    firstName: contact.firstName,
    lastName: contact.lastName,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    statusId: contact.statusId != null ? String(contact.statusId) : '',
    locationId: contact.locationId != null ? String(contact.locationId) : '',
    departmentId: contact.departmentId != null ? String(contact.departmentId) : '',
    isPrimary: contact.isPrimary,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(contact.id as Id, {
      firstName: v.firstName as string, lastName: v.lastName as string,
      role: v.role as string, email: v.email as string, phone: v.phone as string,
      statusId: (v.statusId as string) || null,
      locationId: (v.locationId as string) || null,
      departmentId: (v.departmentId as string) || null,
      isPrimary: Boolean(v.isPrimary),
    })
    setEditing(false)
  }

  const remove = () => { if (window.confirm(t('contacts.deleteConfirm'))) { onDelete(contact.id as Id); close() } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{contact.name}</div>
        <button onClick={remove} title={t('common:delete')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      <EditableFieldTable title={t('contacts.detail.infoTitle')} fields={fields} value={values} onSave={save}
        editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} labelWidth={130} />
    </div>
  )
}
