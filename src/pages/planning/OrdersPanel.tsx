/**
 * OrdersPanel — real Planning Orders list + create entry point (PLANNING-ORDER-CREATE-1).
 *
 * Self-contained on purpose: PlanningPage.tsx (the shift calendar) is under active
 * concurrent edit by another lane in this same session right now (its own real
 * shift-fetching wiring is mid-flight, confirmed live while this file was written —
 * 2026-08-14), so this panel is NOT wired into PlanningPage's JSX here to avoid a
 * destructive edit collision on that shared file. It is a drop-in: render
 * `<OrdersPanel />` from wherever the planning surface wants an "Orders" view/tab —
 * every piece below is real (GET/POST /planning/orders via usePlanningOrders), no
 * demo data, four honest UI states.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ClipboardList } from 'lucide-react'
import { usePlanningOrdersList } from './hooks/usePlanningOrders'
import AddOrderModal from './AddOrderModal'
import { BTN_H } from '@/config/buttonMetrics'

export default function OrdersPanel() {
  const { t } = useTranslation('planning')
  const { orders, loading, error } = usePlanningOrdersList()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('order.listTitle')}</span>
        <button onClick={() => setAddOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px', fontSize: 12,
            fontWeight: 600, background: 'var(--color-primary)', color: 'var(--color-on-accent)',
            border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} /> {t('order.addOrder')}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Four UI states — no fabricated rows (§0: an honest empty, never invented demo data). */}
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
        )}
        {!loading && error && (
          <div role="alert" style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-danger)' }}>{t('order.errorList')}</div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <ClipboardList size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('order.empty')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('order.emptyHint')}</div>
          </div>
        )}
        {!loading && !error && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(o => (
              <div key={String(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {o.subject || o.function || o.reference || t('order.listTitle')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {[o.client, o.location, o.department].filter(Boolean).join(' — ') || '—'}
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                  color: 'var(--color-primary-text)', background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
                  {t(`order.status.${o.status}`, o.status)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('order.shiftsCount', { count: o.shifts_count ?? 0 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && <AddOrderModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}
