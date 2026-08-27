/**
 * LocationDrawer — slide-in panel with one location's details (address,
 * department, customer). Opened from LocationsTable. StatusBadge = active/inactive
 * pill. InfoRow (shared, §3) = one labeled detail row.
 */
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, Building2, MapPin, Layers, Hash } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PageTitle, Caption, GroupLabel, BodyText } from '@/components/ui/typography'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill
import InfoRow from './InfoRow'
import type { ReportLocation } from '@/types/reports'

// Read-only slide-in panel for one location's address/department/customer details, opened from LocationsTable.
export default function LocationDrawer({ location, onClose }: { location: ReportLocation; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
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

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={location?.name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 480, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <MapPin size={15} color="var(--color-primary)" />
                <PageTitle as="span" style={{ fontWeight: 700 }}>{location.name}</PageTitle>
                <StatusBadge status={location.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Building2 size={12} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{location.customer_name}</span>
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

        {/* Summary */}
        <div style={{ display: 'flex', gap: 1, background: 'var(--hover-bg)',
                      borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Layers size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{departments.length}</span>
            </div>
            <Caption as="div" style={{ marginTop: 1 }}>{t('dr.departments')}</Caption>
          </div>
        </div>

        {/* Details */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          <GroupLabel style={{ marginBottom: 8 }}>
            {t('locationDrawer.info')}
          </GroupLabel>

          <InfoRow icon={MapPin}    label={t('dr.address')}    value={fullAddress} />
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
        </div>
      </div>
    </>
  )
}
