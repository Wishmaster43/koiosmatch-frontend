/**
 * LocationDepartments — "Afdelingen op deze locatie": the nested department list
 * inside a location's detail. Filters the customer-wide departments hook by this
 * location id (one source of truth shared with the top-level Afdelingen tab), so
 * a department created/edited/deleted here shows up there too. Edit reuses
 * AddDepartmentModal (same component, edit mode) — never forked.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { AddButton } from '@/components/forms/fields'
import SoftChip from '@/components/ui/SoftChip'
import { useConfirm } from '@/hooks/useConfirm'
import AddDepartmentModal from '../AddDepartmentModal'
import type { DepartmentPayload } from '../hooks/useCustomerDepartments'
import type { Department } from '@/types/customer'
import type { Id, LookupOption } from '@/types/common'

const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12 }
const iconBtn = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)', flexShrink: 0 }

interface Props {
  locationId: Id
  locationName?: string
  departments: Department[]
  locations: { id: Id; name: string }[]
  statuses: LookupOption[]
  onAdd: (payload: DepartmentPayload, locationName?: string) => void
  onUpdate: (id: Id, payload: Partial<DepartmentPayload>, locationName?: string) => void
  onRemove: (id: Id) => void
}

export default function LocationDepartments({ locationId, locationName, departments, locations, statuses, onAdd, onUpdate, onRemove }: Props) {
  const { t } = useTranslation('customers')
  const [modal, setModal] = useState<'add' | Department | null>(null)
  const { confirm, dialog } = useConfirm()
  const rows = departments.filter(d => String(d.locationId) === String(locationId))

  // Delete asks for confirmation; a 409 (still in use) fails soft via the hook's own toast.
  const remove = (d: Department) => confirm(t('departments.deleteConfirm'), () => onRemove(d.id as Id), { danger: true })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('locations.detail.departmentsHere')}</span>
        <AddButton onClick={() => setModal('add')} label={t('locations.detail.addDepartmentHere')} />
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('locations.detail.none')}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {rows.map((d, i) => (
            <div key={String(d.id)} style={{ ...rowStyle, borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ flex: 1, color: 'var(--text)' }}>{d.name}</span>
              {d.statusLabel && <SoftChip label={d.statusLabel} color={d.statusColor} />}
              <button onClick={() => setModal(d)} title={t('common:edit')} style={iconBtn}><Pencil size={12} /></button>
              <button onClick={() => remove(d)} title={t('common:delete')} style={{ ...iconBtn, color: 'var(--color-danger)' }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <AddDepartmentModal
          locations={locations} statuses={statuses} lockLocationId={locationId} customerName={locationName}
          onCreate={payload => onAdd(payload, locationName)}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal !== 'add' && (
        <AddDepartmentModal
          initial={modal} locations={locations} statuses={statuses}
          onCreate={payload => onUpdate(modal.id as Id, payload, locations.find(l => String(l.id) === String(payload.locationId))?.name)}
          onClose={() => setModal(null)}
        />
      )}
      {dialog}
    </div>
  )
}
