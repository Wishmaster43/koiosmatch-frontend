/**
 * DepartmentsTab — the customer's departments as a searchable table. Each row shows
 * which LOCATION it's coupled to (Danny: "je moet kunnen zien aan welke locatie
 * die gekoppeld is") as a soft chip, plus its status; a row drills into
 * DepartmentDetail for full edit (incl. moving to another location) + delete.
 * "+ Afdeling toevoegen" opens the full grouped AddDepartmentModal.
 */
import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Building } from 'lucide-react'
import SubEntityTab from './SubEntityTab'
import DepartmentDetail from './DepartmentDetail'
import AddDepartmentModal from '../AddDepartmentModal'
import type { Column } from '@/components/ui/DataTable'
import SoftChipJs from '@/components/ui/SoftChip'
import type { Contact, Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'

type AnyProps = Record<string, unknown>
const SoftChip = SoftChipJs as unknown as ComponentType<AnyProps>

interface Props {
  customerId?: Id
  departments?: Department[]
  contacts?: Contact[]
  locations?: { id: Id; name: string }[]
  statuses?: LookupOption[]
  onAdd: (payload: DepartmentPayload, locationName?: string) => void
  onUpdate: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemove: (id: Id) => void
}

export default function DepartmentsTab({ departments = [], contacts = [], locations = [], statuses = [], onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation('customers')
  const [adding, setAdding] = useState(false)

  const columns: Column<Department>[] = [
    { key: 'name', header: t('departments.col.name'), sortable: true, sortValue: d => d.name,
      render: d => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building size={14} color="#8B5CF6" style={{ flexShrink: 0 }} />
          <span style={{ color: 'var(--text)' }}>{d.name}</span>
        </div>
      ) },
    { key: 'location', header: t('departments.col.location'), sortable: true, sortValue: d => d.locationName,
      render: d => d.locationName ? <SoftChip label={d.locationName} color="var(--color-secondary)" /> : '—' },
    { key: 'status', header: t('departments.col.status'), sortable: true, sortValue: d => d.statusLabel,
      render: d => d.statusLabel ? <SoftChip label={d.statusLabel} color={d.statusColor} /> : '—' },
    { key: 'contacts', header: t('departments.col.contacts'), align: 'right', cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true,
      sortValue: d => contacts.filter(c => String(c.departmentId) === String(d.id)).length,
      render: d => contacts.filter(c => String(c.departmentId) === String(d.id)).length },
  ]

  const renderDetail = (d: Department, close: () => void) => (
    <DepartmentDetail department={d} locations={locations} statuses={statuses}
      contacts={contacts.filter(c => String(c.departmentId) === String(d.id))}
      onSave={onUpdate} onDelete={onRemove} close={close} />
  )

  return (
    <>
      <SubEntityTab
        items={departments}
        columns={columns}
        addLabel={t('departments.add')}
        emptyText={t('departments.empty')}
        searchPlaceholder={t('departments.searchPlaceholder')}
        backLabel={t('drawer.back')}
        searchKeys={['name', 'locationName']}
        onAdd={() => setAdding(true)}
        renderDetail={renderDetail}
      />
      {adding && (
        <AddDepartmentModal locations={locations} statuses={statuses}
          onCreate={payload => onAdd(payload, locations.find(l => String(l.id) === String(payload.locationId))?.name)}
          onClose={() => setAdding(false)} />
      )}
    </>
  )
}
