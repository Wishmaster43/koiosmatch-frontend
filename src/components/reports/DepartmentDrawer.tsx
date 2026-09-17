/**
 * DepartmentDrawer — slide-in panel with one department's details (customer,
 * location, codes). Opened from DepartmentsTable. Uses shared ReportDrawerChrome.
 */
import { useTranslation } from 'react-i18next'
import { Building2, MapPin, Hash, Layers } from 'lucide-react'
import { PageTitle, GroupLabel } from '@/components/ui/typography'
import ReportDrawerChrome from './ReportDrawerChrome'
import InfoRow from './InfoRow'
import type { ReportDepartment } from '@/types/reports'

// Read-only slide-in with one department's customer/location/code details.
export default function DepartmentDrawer({ department, onClose }: { department: ReportDepartment; onClose: () => void }) {
  const { t } = useTranslation('reports')

  const headerIcon = <Layers size={15} color="var(--color-primary)" />
  const headerMeta = (
    <div>
      <PageTitle as="span" style={{ fontWeight: 700 }}>{department.name}</PageTitle>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
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
  )

  return (
    <ReportDrawerChrome title={department.name ?? t('departmentDrawer.untitled')} onClose={onClose} headerIcon={headerIcon} headerMeta={headerMeta}>
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
    </ReportDrawerChrome>
  )
}
