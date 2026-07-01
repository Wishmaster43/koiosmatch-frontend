/**
 * CustomerDetailDrawer — slide-in panel with one customer's details (locations,
 * departments, contacts). Opened from CustomersTable. StatusBadge = active/inactive pill.
 */
import type { ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import { X, MapPin, Building2, Hash, User, Layers } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill
import type { ReportCustomer } from '../../types/reports'

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: ReactNode; value?: ReactNode }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
      <Icon size={12} color="var(--border)" style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

export default function CustomerDetailDrawer({ customer, onClose }: { customer: ReportCustomer; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('reports')
  const locations = customer.locations ?? []
  const totalDepts = locations.reduce((s, l) => s + (l.departments?.length ?? 0), 0)

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={customer?.name as string | undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col bg-[var(--surface)]"
        style={{ width: 560, boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{customer.name}</span>
              <StatusBadge status={customer.status} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <InfoRow icon={Hash}    label={t('customerDrawer.debtorNumber')}   value={customer.debtor_number} />
              <InfoRow icon={Hash}    label={t('dr.externalId')}                 value={customer.external_id} />
              <InfoRow icon={User}    label={t('customerDrawer.accountManager')} value={customer.account_manager} />
            </div>
          </div>
          <button onClick={onClose} aria-label={t('common:close')}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                     borderRadius: 6, marginLeft: 10 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
            <X size={15} />
          </button>
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{b.label}</div>
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
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{loc.name}</div>
                  {(loc.street || loc.city) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {[loc.street, loc.house_number, loc.postal_code, loc.city]
                        .filter(Boolean).join(' ')}
                    </div>
                  )}
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
          <button onClick={onClose}
            style={{ fontSize: 12, borderRadius: 6, padding: '5px 14px',
                     background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            {t('dr.close')}
          </button>
        </div>
      </div>
    </>
  )
}
