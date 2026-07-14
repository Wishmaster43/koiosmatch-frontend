/**
 * LocationsTab — the customer's locations as a searchable table; a row drills into
 * the fully editable LocationDetail (C-6 address fields + status + nested
 * departments/contacts management). "+ Locatie toevoegen" opens the full grouped
 * AddLocationModal (Danny 13/7: the old name+city-only popup was "far too bare").
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import LocationDetail from './LocationDetail'
import AddLocationModal from '../AddLocationModal'
import type { Column } from '@/components/ui/DataTable'
import SoftChipJs from '@/components/ui/SoftChip'
import type { Contact, Department, Location } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { LocationPayload } from '../hooks/useCustomerLocations'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { ContactPayload } from '../hooks/useCustomerContacts'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>

interface Props {
  customerId?: Id
  customerName?: string
  locations?: Location[]
  departments?: Department[]
  contacts?: Contact[]
  statuses?: LookupOption[]
  departmentStatuses?: LookupOption[]
  contactStatuses?: LookupOption[]
  onAddLocation: (payload: LocationPayload) => void
  onSaveLocation: (id: Id, payload: Partial<LocationPayload>) => void
  onDeleteLocation: (id: Id) => void
  onAddDepartment: (payload: DepartmentPayload, locationName?: string) => void
  onUpdateDepartment: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemoveDepartment: (id: Id) => void
  onAddContact: (payload: ContactPayload) => void
  onUpdateContact: (id: Id, payload: Partial<ContactPayload>) => void
}

export default function LocationsTab({
  customerId, customerName, locations = [], departments = [], contacts = [], statuses = [], departmentStatuses = [], contactStatuses = [],
  onAddLocation, onSaveLocation, onDeleteLocation, onAddDepartment, onUpdateDepartment, onRemoveDepartment, onAddContact, onUpdateContact,
}: Props) {
  const { t } = useTranslation('customers')
  const [adding, setAdding] = useState(false)

  const columns: Column<Location>[] = [
    { key: 'name', header: t('locations.col.name'), sortable: true, sortValue: l => l.name,
      render: l => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={14} color="var(--color-secondary)" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{l.name}</span>
        </div>
      ) },
    { key: 'city', header: t('locations.col.city'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true, sortValue: l => l.city, render: l => l.city || '—' },
    { key: 'status', header: t('locations.col.status'), sortable: true, sortValue: l => l.statusLabel,
      render: l => l.statusLabel ? <SoftChip label={l.statusLabel} color={l.statusColor} /> : '—' },
    { key: 'departments', header: t('locations.col.departments'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true,
      sortValue: l => departments.filter(d => String(d.locationId) === String(l.id)).length,
      render: l => departments.filter(d => String(d.locationId) === String(l.id)).length },
    { key: 'contacts', header: t('locations.col.contacts'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true,
      sortValue: l => contacts.filter(c => String(c.locationId) === String(l.id)).length,
      render: l => contacts.filter(c => String(c.locationId) === String(l.id)).length },
  ]

  const renderDetail = (l: Location, close: () => void) => (
    <LocationDetail
      location={l} customerId={customerId}
      locations={locations.map(x => ({ id: x.id as Id, name: x.name }))}
      departments={departments} contacts={contacts}
      statuses={statuses} departmentStatuses={departmentStatuses} contactStatuses={contactStatuses}
      onSave={onSaveLocation} onDelete={onDeleteLocation}
      onAddDepartment={onAddDepartment} onUpdateDepartment={onUpdateDepartment} onRemoveDepartment={onRemoveDepartment}
      onAddContact={onAddContact} onUpdateContact={onUpdateContact}
      close={close}
    />
  )

  return (
    <>
      <SubEntityTab
        items={locations}
        columns={columns}
        addLabel={t('locations.add')}
        emptyText={t('locations.empty')}
        searchPlaceholder={t('locations.searchPlaceholder')}
        backLabel={t('drawer.back')}
        searchKeys={['name', 'city']}
        onAdd={() => setAdding(true)}
        renderDetail={renderDetail}
      />
      {adding && (
        <AddLocationModal customerName={customerName} statuses={statuses}
          onCreate={onAddLocation} onClose={() => setAdding(false)} />
      )}
    </>
  )
}
