/**
 * LocationDetail — the Locaties-tab drill-down (Danny 13/7: "kan niets wijzigen,
 * de naam niets???"). Fully editable via the shared EditableFieldTable house
 * pattern (pencil → save/cancel, optimistic PATCH via the parent's onSave), grouped
 * into Algemeen / Adres / Registratie / Contact ter plaatse / Facturatie cards.
 * Nested department + contact management for this location lives in
 * LocationDepartments / LocationContacts (shared hooks, one source of truth with
 * the top-level tabs). Delete asks for confirmation and returns to the list.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import EditableFieldTable from '@/components/forms/EditableFieldTable'
import type { FieldRow } from '@/components/forms/EditableFieldTable'
import SectionCard from '@/components/ui/SectionCard'
import LocationDepartments from './LocationDepartments'
import LocationContacts from './LocationContacts'
import PlanningSummary from './PlanningSummary'
import { useAuth } from '@/context/AuthContext'
import type { Contact, Department, Location } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { LocationPayload } from '../hooks/useCustomerLocations'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

interface Props {
  location: Location
  customerId?: Id
  locations: { id: Id; name: string }[]
  departments: Department[]
  contacts: Contact[]
  statuses: LookupOption[]
  departmentStatuses: LookupOption[]
  contactStatuses: LookupOption[]
  onSave: (id: Id, payload: Partial<LocationPayload>) => void
  onDelete: (id: Id) => void
  onAddDepartment: (payload: DepartmentPayload, locationName?: string) => void
  onUpdateDepartment: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemoveDepartment: (id: Id) => void
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
  close: () => void
}

export default function LocationDetail({
  location: l, customerId, locations, departments, contacts, statuses, departmentStatuses, contactStatuses,
  onSave, onDelete, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact, close,
}: Props) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  const [editing, setEditing] = useState(false)

  const statusOptions = statuses.map(s => ({ value: String(s.id ?? s.value), label: s.label }))
  const fields: FieldRow[] = [
    { key: 'name', label: t('locations.detail.name'), type: 'text', group: t('subModal.groups.general') },
    { key: 'statusId', label: t('locations.detail.status'), type: 'select', options: statusOptions, group: t('subModal.groups.general') },
    { key: 'isHeadquarter', label: t('locations.detail.headquarter'), type: 'checkbox', group: t('subModal.groups.general') },
    { key: 'street', label: t('locations.detail.street'), type: 'text', group: t('subModal.groups.address') },
    { key: 'houseNumber', label: t('locations.detail.houseNumber'), type: 'text', group: t('subModal.groups.address') },
    { key: 'houseNumberSuffix', label: t('locations.detail.houseNumberSuffix'), type: 'text', group: t('subModal.groups.address') },
    // BUG FIX (Danny 13/7): postcode and city are now two separate rows/fields —
    // the old read-only view joined postalCode + city into one "Postcode" row.
    { key: 'postalCode', label: t('locations.detail.postalCode'), type: 'text', group: t('subModal.groups.address') },
    { key: 'city', label: t('locations.detail.city'), type: 'text', group: t('subModal.groups.address') },
    { key: 'state', label: t('locations.detail.state'), type: 'text', group: t('subModal.groups.address') },
    { key: 'country', label: t('locations.detail.country'), type: 'text', group: t('subModal.groups.address') },
    { key: 'cocNumber', label: t('locations.detail.coc'), type: 'text', group: t('locations.detail.registrationTitle') },
    { key: 'vatNumber', label: t('locations.detail.vat'), type: 'text', group: t('locations.detail.registrationTitle') },
    { key: 'contactName', label: t('locations.detail.contactName'), type: 'text', group: t('locations.detail.contactTitle') },
    { key: 'email', label: t('locations.detail.email'), type: 'text', group: t('locations.detail.contactTitle') },
    { key: 'phone', label: t('locations.detail.phone'), type: 'text', group: t('locations.detail.contactTitle') },
    { key: 'costCenter', label: t('locations.detail.costCenter'), type: 'text', group: t('locations.detail.billingTitle') },
    { key: 'billingEmail', label: t('locations.detail.billingEmail'), type: 'text', group: t('locations.detail.billingTitle') },
  ]

  const values = {
    name: l.name, statusId: l.statusId != null ? String(l.statusId) : '', isHeadquarter: l.isHeadquarter,
    street: l.street, houseNumber: l.houseNumber, houseNumberSuffix: l.houseNumberSuffix,
    postalCode: l.postalCode, city: l.city, state: l.state, country: l.country,
    cocNumber: l.cocNumber, vatNumber: l.vatNumber,
    contactName: l.contactName, email: l.email, phone: l.phone,
    costCenter: l.costCenter, billingEmail: l.billingEmail,
  }

  const save = (v: Record<string, unknown>) => {
    onSave(l.id as Id, {
      name: v.name as string, statusId: (v.statusId as string) || null, isHeadquarter: Boolean(v.isHeadquarter),
      street: v.street as string, houseNumber: v.houseNumber as string, houseNumberSuffix: v.houseNumberSuffix as string,
      postalCode: v.postalCode as string, city: v.city as string, state: v.state as string, country: v.country as string,
      cocNumber: v.cocNumber as string, vatNumber: v.vatNumber as string,
      contactName: v.contactName as string, email: v.email as string, phone: v.phone as string,
      costCenter: v.costCenter as string, billingEmail: v.billingEmail as string,
    })
    setEditing(false)
  }

  const remove = () => { if (window.confirm(t('locations.detail.confirmDelete'))) { onDelete(l.id as Id); close() } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{l.name}</div>
        <button onClick={remove} title={t('locations.detail.deleteLocation')}
          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--color-danger)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      <EditableFieldTable title={t('locations.detail.addressTitle')} fields={fields} value={values} onSave={save}
        editing={editing} onStartEdit={() => setEditing(true)} onCancel={() => setEditing(false)} labelWidth={140} />

      <LocationDepartments locationId={l.id as Id} locationName={l.name} departments={departments} locations={locations}
        statuses={departmentStatuses} onAdd={onAddDepartment} onUpdate={onUpdateDepartment} onRemove={onRemoveDepartment} />

      <LocationContacts locationId={l.id as Id} locationName={l.name} contacts={contacts} locations={locations}
        departments={departments} statuses={contactStatuses} onAdd={onAddContact} onUpdate={onUpdateContact} />

      {hasPlanning && (
        <SectionCard title={t('planning.title')}>
          <PlanningSummary customerId={customerId ?? ''} params={{ location_id: l.id }} />
        </SectionCard>
      )}
    </div>
  )
}
