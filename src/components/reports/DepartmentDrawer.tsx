/**
 * DepartmentDrawer — slide-in panel with one department's details (customer,
 * location, codes). Opened from DepartmentsTable. InfoRow = one labeled detail row.
 */
import type { ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building2, MapPin, Hash, Layers } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReportDepartment } from '@/types/reports'

// One labeled row of department info (hidden when value is empty).
function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: ReactNode; value?: ReactNode }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--hover-bg)' }}>
      <Icon size={13} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

export default function DepartmentDrawer({ department, onClose }: { department: ReportDepartment; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={department?.name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 420, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Layers size={15} color="var(--color-primary)" />
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{department.name}</span>
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
            <button onClick={onClose} aria-label={t('common:close')}
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                       background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                       borderRadius: 6, marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', marginBottom: 8 }}>
            {t('departmentDrawer.info')}
          </div>

          <InfoRow icon={Layers}    label={t('departmentDrawer.name')} value={department.name} />
          <InfoRow icon={Hash}      label={t('dr.costCenter')}         value={department.cost_center} />
          <InfoRow icon={Hash}      label={t('dr.externalId')}         value={department.external_id} />
          <InfoRow icon={MapPin}    label={t('dr.location')}           value={department.location_name} />
          <InfoRow icon={Building2} label={t('dr.customer')}           value={department.customer_name} />

          {department.remarks && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.05em', marginBottom: 8 }}>
                {t('dr.remarks')}
              </div>
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
