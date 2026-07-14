/**
 * ContactsTab — the customer's contact persons as a searchable table. Each row
 * shows the coupled LOCATION + DEPARTMENT as soft chips; a row drills into
 * ContactDetail for full edit (EditableFieldTable house pattern) + delete.
 * "+ Nieuw contactpersoon" opens the full grouped AddContactPersonModal.
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Check } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import ContactDetail from './ContactDetail'
import AddContactPersonModal from '../AddContactPersonModal'
import type { Column } from '@/components/ui/DataTable'
import SoftChipJs from '@/components/ui/SoftChip'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>
const muted = { color: 'var(--text-muted)', fontSize: 12 }

interface Props {
  contacts?: Contact[]
  locations?: { id: Id; name: string }[]
  departments?: Department[]
  statuses?: LookupOption[]
  onAdd: (payload: ContactPayload) => void
  onUpdate: (id: Id, payload: Partial<ContactPayload>) => void
  onRemove: (id: Id) => void
}

export default function ContactsTab({ contacts = [], locations = [], departments = [], statuses = [], onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation('customers')
  const [adding, setAdding] = useState(false)

  const columns: Column<Contact>[] = [
    { key: 'name', header: t('contacts.col.name'), sortable: true, sortValue: p => p.name,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{p.name}</span>
          {p.isPrimary && <Check size={12} color="var(--color-success)" />}
        </div>
      ) },
    { key: 'location', header: t('contacts.col.location'), sortable: true, sortValue: p => p.locationName,
      render: p => p.locationName ? <SoftChip label={p.locationName} color="var(--color-secondary)" /> : '—' },
    { key: 'department', header: t('contacts.col.department'), sortable: true, sortValue: p => p.departmentName,
      render: p => p.departmentName ? <SoftChip label={p.departmentName} color="#8B5CF6" /> : '—' },
    { key: 'role',  header: t('contacts.col.role'),  cellStyle: muted, sortable: true, sortValue: p => p.role,  render: p => p.role || '—' },
    { key: 'email', header: t('contacts.col.email'), cellStyle: muted, sortable: true, sortValue: p => p.email, render: p => p.email || '—' },
    { key: 'phone', header: t('contacts.col.phone'), nowrap: true, cellStyle: muted, sortable: true, sortValue: p => p.phone, render: p => p.phone || '—' },
  ]

  const renderDetail = (p: Contact, close: () => void) => (
    <ContactDetail contact={p} locations={locations} departments={departments} statuses={statuses}
      onSave={onUpdate} onDelete={onRemove} close={close} />
  )

  return (
    <>
      <SubEntityTab
        items={contacts}
        columns={columns}
        addLabel={t('contacts.add')}
        emptyText={t('contacts.empty')}
        searchPlaceholder={t('contacts.searchPlaceholder')}
        backLabel={t('drawer.back')}
        searchKeys={['name', 'role', 'email']}
        onAdd={() => setAdding(true)}
        renderDetail={renderDetail}
      />
      {adding && (
        <AddContactPersonModal locations={locations} departments={departments} statuses={statuses}
          onCreate={onAdd} onClose={() => setAdding(false)} />
      )}
    </>
  )
}
