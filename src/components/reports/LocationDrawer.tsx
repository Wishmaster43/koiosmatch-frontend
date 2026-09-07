/**
 * LocationDrawer — slide-in panel with one location's details (address,
 * department, customer). Opened from LocationsTable. Uses shared ReportDrawerChrome.
 */
import { useTranslation } from 'react-i18next'
import { Building2, MapPin, Layers, Hash } from 'lucide-react'
import { PageTitle, Caption, GroupLabel, BodyText } from '@/components/ui/typography'
import StatusBadge from '../ui/StatusBadge'
import ReportDrawerChrome from './ReportDrawerChrome'
import InfoRow from './InfoRow'
import CopyIconButton from '../ui/CopyIconButton'
import type { ReportLocation } from '@/types/reports'

// Read-only slide-in panel for one location's address/department/customer details.
export default function LocationDrawer({ location, onClose }: { location: ReportLocation; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const departments = location.departments ?? []

  const addressParts = [
    location.street && location.house_number
      ? `${location.street} ${location.house_number}`
      : (location.street ?? null),
    location.postal_code,
    location.city,
    location.country,
  ].filter(Boolean)
  const fullAddress = addressParts.join(', ') || null

  const headerIcon = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <MapPin size={15} color="var(--color-primary)" />
      <PageTitle as="span" style={{ fontWeight: 700 }}>{location.name}</PageTitle>
      <StatusBadge status={location.status} />
    </div>
  )

  const headerMeta = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
      <Building2 size={12} color="var(--text-muted)" />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{location.customer_name}</span>
    </div>
  )

  return (
    <ReportDrawerChrome title={location.name ?? 'Location'} onClose={onClose} headerIcon={headerIcon} headerMeta={headerMeta}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 1, background: 'var(--hover-bg)', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: '10px 16px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Layers size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{departments.length}</span>
          </div>
          <Caption as="div" style={{ marginTop: 1 }}>{t('dr.departments')}</Caption>
        </div>
      </div>

      <GroupLabel style={{ marginBottom: 8 }}>
        {t('locationDrawer.info')}
      </GroupLabel>

      <InfoRow icon={MapPin}    label={t('dr.address')}    value={fullAddress
        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{fullAddress}<CopyIconButton label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} value={fullAddress} /></span>
        : null} />
      <InfoRow icon={Hash}      label={t('dr.externalId')} value={location.external_id} />
      <InfoRow icon={Building2} label={t('dr.customer')}   value={location.customer_name} />

      {departments.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <GroupLabel style={{ marginBottom: 10 }}>
            {t('locationDrawer.departmentsCount', { count: departments.length })}
          </GroupLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {departments.map((d, i) => (
              <div key={d.id ?? i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                         background: 'var(--hover-bg)', borderRadius: 8, padding: '9px 12px' }}>
                <div>
                  <BodyText as="div" style={{ fontWeight: 500 }}>{d.name}</BodyText>
                  {d.cost_center && (
                    <Caption as="div" style={{ fontFamily: 'monospace', marginTop: 1 }}>
                      {d.cost_center}
                    </Caption>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReportDrawerChrome>
  )
}
