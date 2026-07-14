/**
 * DepartmentDetail — the Afdelingen-tab drill-down. Full edit via the shared
 * EditableFieldTable house pattern (pencil → save/cancel): name, location (movable
 * per CustomerDepartmentController — `location_id` is `sometimes` on update),
 * description, status. Delete asks for confirmation and fails soft (409 = in use)
 * via the hook's own toast. Nested contacts-in-this-department stay read-only here
 * (full contact management lives on the Contactpersonen tab / location detail).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SectionCard from '@/components/ui/SectionCard'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'

export default function DepartmentDetail({ department, locations, statuses, contacts = [], onSave, onDelete, close }: {
  department: Department
  locations: { id: Id; name: string }[]
  statuses: LookupOption[]
  // The customer's contacts filtered to this department by the caller (the resource
  // itself doesn't embed contacts — CustomerDepartmentResource has no `contacts` field).
  contacts?: Contact[]
  onSave: (id: Id, payload: Partial<DepartmentPayload>) => void
  onDelete: (id: Id) => void
  close: () => void
}) {
  const { t } = useTranslation('customers')
  const [editing, setEditing] = useState(false)

  const fields: FieldRow[] = [
    { key: 'name', label: t('departments.detail.name'), type: 'text' },
    { key: 'locationId', label: t('departments.detail.location'), type: 'select', options: locations.map(l => ({ value: String(l.id), label: l.name })) },
    { key: 'description', label: t('departments.detail.description'), type: 'textarea' },
    { key: 'statusId', label: t('locations.detail.status'), type: 'select', options: statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label })) },
  ]

  // The read/edit values keyed like the fields above; locationId/statusId compare as strings.
  const values = {
    name: department.name,
    locationId: department.locationId != null ? String(department.locationId) : '',
    description: department.description,
    statusId: department.statusId != null ? String(department.statusId) : '',
  }

  const save = (v: Record<string, unknown>) => {
    onSave(department.id as Id, { name: v.name as string, locationId: v.locationId as string, description: v.description as string, statusId: (v.statusId as string) || null })
    setEditing(false)
  }

  const remove = () => { if (window.confirm(t('departments.deleteConfirm'))) { onDelete(department.id as Id); close() } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{department.name}</div>
        <button onClick={remove} title={t('common:delete')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      <EditableFieldTable title={t('departments.detail.infoTitle')} fields={fields} value={values} onSave={save}
        editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} labelWidth={130} />

      <SectionCard title={t('departments.detail.contactsHere')}>
        {contacts.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('departments.detail.none')}</div>
          : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {contacts.map((p, i, arr) => (
                <div key={p.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{p.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{[p.role, p.email].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </div>
          )}
      </SectionCard>
    </div>
  )
}
