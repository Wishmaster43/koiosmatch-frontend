/**
 * CustomerDetailDrawer — slide-in panel with one customer's details (locations,
 * departments, contacts). Opened from CustomersTable. StatusBadge = active/inactive
 * pill. InfoRow (shared, §3, `variant="inline"`) = one labeled header line.
 * Backdrop/focus-trap/header/close shell comes from the shared ReportDrawerChrome
 * (D1 audit fix) — this drawer only supplies its own header meta, body and footer.
 */
import { useTranslation } from 'react-i18next'
import { MapPin, Building2, Hash, User, Layers } from 'lucide-react'
import Button from '@/components/ui/Button'
import { PageTitle, Caption, SectionTitle } from '@/components/ui/typography'
import ReportStatStrip from './ReportStatStrip'
import StatusBadge from '../ui/StatusBadge'  // shared active/inactive status pill
import InfoRow from './InfoRow'
import CopyIconButton from '../ui/CopyIconButton'
import ReportDrawerChrome from './ReportDrawerChrome'
import type { ReportCustomer } from '@/types/reports'

// Read-only slide-in with one customer's locations/departments/contacts, opened
// from CustomersTable; the shared ReportDrawerChrome traps focus while open (§6)
// and closes on backdrop click.
export default function CustomerDetailDrawer({ customer, onClose }: { customer: ReportCustomer; onClose: () => void }) {
  const { t } = useTranslation('reports')
  const locations = customer.locations ?? []
  const totalDepts = locations.reduce((s, l) => s + (l.departments?.length ?? 0), 0)

  // Header meta: name + status badge + inline debtor/external-id/account-manager rows.
  const headerMeta = (
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
  )

  return (
    <ReportDrawerChrome title={customer?.name as string | undefined ?? t('customerDrawer.untitled')} onClose={onClose}
      headerMeta={headerMeta} width={560}
      footer={<Button variant="mutedOutline" onClick={onClose}>{t('dr.close')}</Button>}>

      {/* Summary — negative margin pulls it flush to the chrome's own body padding. */}
      <ReportStatStrip cellPadding="10px 16px" style={{ border: '1px solid var(--border)', borderRadius: 8, margin: '-4px 0 12px 0', overflow: 'hidden' }}
        items={[
          { label: t('customerDrawer.locations'),   value: locations.length,  icon: MapPin },
          { label: t('customerDrawer.departments'), value: totalDepts,         icon: Layers },
        ]} />

      {/* Locations list */}
      {locations.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 100, fontSize: 13, color: 'var(--text-muted)' }}>
          {t('customerDrawer.noLocations')}
        </div>
      )}
      {locations.map((loc, i) => (
        <div key={loc.id ?? i}
          style={{ padding: '12px 0', borderBottom: '1px solid var(--hover-bg)' }}>

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
    </ReportDrawerChrome>
  )
}
