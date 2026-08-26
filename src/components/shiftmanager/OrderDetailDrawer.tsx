/**
 * OrderDetailDrawer — slide-in panel showing every field of one shift/order row:
 * identification, planning, customer/location, hours, invited candidates and
 * notes. Pure presentation; the row is passed in from OrdersTable.
 */
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { Section, formatDate, formatTime, formatHours } from './ordersTableParts'
import type { OrderRow } from '@/types/shiftmanager'
import { BodyText, Caption } from '@/components/ui/typography'

// Labelled value, dash when empty — module scope (props-only), so React never
// recreates the component type per render (react-hooks/static-components).
const Field = ({ label, value }: { label: ReactNode; value?: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    <BodyText as="span">{value || '—'}</BodyText>
  </div>
)

// Read-only slide-in detail panel for one Shiftmanager order; renders nothing without a row (see file header).
export default function OrderDetailDrawer({ row, onClose }: { row: OrderRow | null; onClose: () => void }) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('shiftmanager')
  if (!row) return null

  const loc      = row.order?.customerLocation
  const customer = loc?.customer ?? row.order?.customer
  const invites  = row.invites ?? []


  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('orders.drawer.title')} tabIndex={-1}
        className="fixed right-0 top-0 bottom-0 z-40 overflow-y-auto"
        style={{ width: 400, background: 'var(--surface)', borderLeft: '1px solid var(--border)',
                 boxShadow: 'var(--shadow-drawer)' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('orders.drawer.title')}</h3>
            <Caption as="p" style={{ marginTop: 2 }}>{row.external_id ?? row.id}</Caption>
          </div>
          {/* Bare close glyph in sm-drawer chrome, not a Button copy. Block form:
              the style attr sits a line into the tag. */}
          {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
          <button onClick={onClose} aria-label={t('common:close')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
          {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
        </div>

        <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Section title={t('orders.drawer.identification')}>
            <Field label={t('orders.drawer.shiftId')}      value={row.id} />
            <Field label={t('orders.drawer.externalId')}   value={row.external_id} />
            <Field label={t('orders.drawer.scheduledId')}  value={row.scheduled_id ?? row.schedule_id} />
            <Field label={t('orders.drawer.orderRef')}     value={row.order?.order_ref} />
          </Section>

          <Section title={t('orders.drawer.planning')}>
            <Field label={t('orders.drawer.date')}         value={formatDate(row.start_time)} />
            <Field label={t('orders.drawer.startTime')}    value={formatTime(row.start_time)} />
            <Field label={t('orders.drawer.endTime')}      value={formatTime(row.end_time)} />
            <Field label={t('orders.drawer.jobType')}      value={row.job_type} />
            <Field label={t('orders.drawer.persons')}      value={row.number_persons} />
            <Field label={t('orders.drawer.status')}       value={row.own_status ? t(`orders.status.${row.own_status}`, { defaultValue: row.own_status }) : null} />
          </Section>

          <Section title={t('orders.drawer.customerLocation')}>
            <Field label={t('orders.drawer.customer')}     value={customer?.name} />
            <Field label={t('orders.drawer.location')}     value={loc?.name} />
            <Field label={t('orders.drawer.address')}      value={loc?.address} />
          </Section>

          <Section title={t('orders.drawer.hours')}>
            <Field label={t('orders.drawer.hoursCand')}    value={formatHours(row.worked_hours_candidate ?? row.hours_worked)} />
            <Field label={t('orders.drawer.hoursCust')}    value={formatHours(row.worked_hours_customer  ?? row.billed_hours)} />
            <Field label={t('orders.drawer.ccCand')}       value={row.cost_center_candidate ?? row.cost_center} />
            <Field label={t('orders.drawer.ccCust')}       value={row.cost_center_customer  ?? row.order?.cost_center} />
          </Section>

          {invites.length > 0 && (
            <Section title={t('orders.drawer.candidates')}>
              {invites.map((inv, i) => {
                const c = inv.candidate
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 10px', background: 'var(--bg)',
                                        borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700 }}>
                      {c ? `${(c.first_name??'')[0]??''}${(c.last_name??'')[0]??''}`.toUpperCase() : '?'}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                        {c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : '—'}
                      </div>
                      <Caption as="div">
                        {inv.status ?? ''}
                      </Caption>
                    </div>
                  </div>
                )
              })}
            </Section>
          )}

          {row.notes && (
            <Section title={t('orders.drawer.notes')}>
              <BodyText>{row.notes}</BodyText>
            </Section>
          )}
        </div>
      </div>
    </>
  )
}
