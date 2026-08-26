/**
 * DepartmentDrawer — slide-in panel with one department's details (customer,
 * location, codes). Opened from DepartmentsTable. InfoRow (shared, §3) = one
 * labeled detail row.
 */
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building2, MapPin, Hash, Layers } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PageTitle, GroupLabel } from '@/components/ui/typography'
import InfoRow from './InfoRow'
import type { ReportDepartment } from '@/types/reports'

// Read-only slide-in with one department's customer/location/code details (see
// file docblock above); traps focus while open (§6).
export default function DepartmentDrawer({ department, onClose }: { department: ReportDepartment; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={department?.name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 420, boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Layers size={15} color="var(--color-primary)" />
                <PageTitle as="span" style={{ fontWeight: 700 }}>{department.name}</PageTitle>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{department.customer_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{department.location_name}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}
              style={{ marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </Button>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <GroupLabel style={{ marginBottom: 8 }}>
            {t('departmentDrawer.info')}
          </GroupLabel>

          <InfoRow icon={Layers}    label={t('departmentDrawer.name')} value={department.name} />
          <InfoRow icon={Hash}      label={t('dr.costCenter')}         value={department.cost_center} />
          <InfoRow icon={Hash}      label={t('dr.externalId')}         value={department.external_id} />
          <InfoRow icon={MapPin}    label={t('dr.location')}           value={department.location_name} />
          <InfoRow icon={Building2} label={t('dr.customer')}           value={department.customer_name} />

          {department.remarks && (
            <div style={{ marginTop: 16 }}>
              <GroupLabel style={{ marginBottom: 8 }}>
                {t('dr.remarks')}
              </GroupLabel>
              <div style={{ fontSize: 12, color: 'var(--text)', background: 'var(--hover-bg)', borderRadius: 8,
                            padding: '10px 12px', lineHeight: 1.6 }}>
                {department.remarks}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
