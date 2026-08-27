/**
 * CustomerDetailDrawer — slide-in panel with one customer's details (locations,
 * departments, contacts). Opened from CustomersTable. StatusBadge = active/inactive
 * pill. InfoRow (shared, §3, `variant="inline"`) = one labeled header line.
 */
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, MapPin, Building2, Hash, User, Layers } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PageTitle, Caption, SectionTitle } from '@/components/ui/typography'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill
import InfoRow from './InfoRow'
import CopyIconButton from '../ui/CopyIconButton'
import type { ReportCustomer } from '@/types/reports'

// Read-only slide-in with one customer's locations/departments/contacts, opened
// from CustomersTable; traps focus while open (§6) and closes on backdrop click.
export default function CustomerDetailDrawer({ customer, onClose }: { customer: ReportCustomer; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  const locations = customer.locations ?? []
  const totalDepts = locations.reduce((s, l) => s + (l.departments?.length ?? 0), 0)

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={customer?.name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 560, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <PageTitle as="span" style={{ fontWeight: 700 }}>{customer.name}</PageTitle>
              <StatusBadge status={customer.status} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <InfoRow icon={Hash}    label={t('customerDrawer.debtorNumber')}   value={customer.debtor_number} variant="inline" />
              <InfoRow icon={Hash}    label={t('dr.externalId')}                 value={customer.external_id} variant="inline" />
              <InfoRow icon={User}    label={t('customerDrawer.accountManager')} value={customer.account_manager} variant="inline" />
            </div>
          </div>
          <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}
            style={{ marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </Button>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 1, background: 'var(--hover-bg)',
                      borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { label: t('customerDrawer.locations'),   value: locations.length,  icon: MapPin },
            { label: t('customerDrawer.departments'), value: totalDepts,         icon: Layers },
          ].map(b => (
            <div key={b.label} style={{ flex: 1, padding: '10px 16px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <b.icon size={12} color="var(--text-muted)" />
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{b.value}</span>
              </div>
              <Caption as="div" style={{ marginTop: 1 }}>{b.label}</Caption>
            </div>
          ))}
        </div>

        {/* Locations list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {locations.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: 100, fontSize: 13, color: 'var(--text-muted)' }}>
              {t('customerDrawer.noLocations')}
            </div>
          )}
          {locations.map((loc, i) => (
            <div key={loc.id ?? i}
              style={{ padding: '12px 18px', borderBottom: '1px solid var(--hover-bg)' }}>

              {/* Location header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                              background: 'var(--color-secondary-bg)', display: 'flex', alignItems: 'center',
                              justifyContent: 'center' }}>
                  <Building2 size={13} color="var(--color-secondary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SectionTitle as="div">{loc.name}</SectionTitle>
                  {(loc.street || loc.city) && (() => {
                    const line = [loc.street, loc.house_number, loc.postal_code, loc.city].filter(Boolean).join(' ')
                    return (
                      <Caption as="div" style={{ marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {line}
                        <CopyIconButton label={t('common:copyAddress.copy')} copiedLabel={t('common:copyAddress.copied')} value={line} />
                      </Caption>
                    )
                  })()}
                </div>
                <StatusBadge status={loc.status} />
              </div>

              {/* Departments */}
              {(loc.departments ?? []).length > 0 && (
                <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(loc.departments ?? []).map((dept, j) => (
                    <div key={dept.id ?? j}
                      style={{ display: 'flex', alignItems: 'center', gap: 6,
                               padding: '4px 8px', borderRadius: 6, background: 'var(--hover-bg)' }}>
                      <Layers size={10} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{dept.name}</span>
                      {dept.cost_center && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {dept.cost_center}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 18px',
                      borderTop: '1px solid var(--border)', background: 'var(--hover-bg)', flexShrink: 0 }}>
          <Button variant="mutedOutline" onClick={onClose}>
            {t('dr.close')}
          </Button>
        </div>
      </div>
    </>
  )
}
