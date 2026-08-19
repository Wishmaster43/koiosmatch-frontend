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
import { Plus, ClipboardList, Pencil, Trash2 } from 'lucide-react'
import { usePlanningOrdersList, useDeletePlanningOrder } from './hooks/usePlanningOrders'
import type { PlanningOrderRow } from './hooks/usePlanningOrders'
import AddOrderModal from './AddOrderModal'
import { extractApiError } from '@/lib/extractApiError'
import Button from '@/components/ui/Button'

export default function OrdersPanel() {
  const { t } = useTranslation('planning')
  const { orders, loading, error } = usePlanningOrdersList()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<PlanningOrderRow | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PlanningOrderRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteOrder = useDeletePlanningOrder()

  // Cancel-shifts-first is a real, honest 409 reason from the backend (never a
  // generic failure) — surfaced via the shared extractApiError (§3/§13).
  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return
    try {
      await deleteOrder.mutateAsync(pendingDelete.id)
      setPendingDelete(null)
      setDeleteError(null)
    } catch (err) {
      setDeleteError(extractApiError(err, t('order.deleteError')))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{t('order.listTitle')}</span>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> {t('order.addOrder')}
        </Button>
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
                <Button variant="secondary" iconOnly size="sm" onClick={() => setEditing(o)} aria-label={t('common:edit')} title={t('common:edit')}>
                  <Pencil size={13} />
                </Button>
                <Button variant="dangerSoft" iconOnly size="sm" onClick={() => { setPendingDelete(o); setDeleteError(null) }} aria-label={t('common:delete')} title={t('common:delete')}>
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && <AddOrderModal onClose={() => setAddOpen(false)} />}
      {editing && <AddOrderModal order={editing} onClose={() => setEditing(null)} />}

      {pendingDelete && (
        <div role="dialog" aria-modal="true" aria-label={t('order.deleteConfirmTitle')}
          style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, #000 40%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-confirm)' }}>
          <div style={{ width: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('order.deleteConfirmTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('order.deleteConfirmBody')}</div>
            {deleteError && (
              <div role="alert" style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, marginBottom: 12,
                color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {/* Dialog footer = md, matching every other confirm footer (Opus batch B R2). */}
              <Button variant="secondary" onClick={() => { setPendingDelete(null); setDeleteError(null) }}>
                {t('common:cancel')}
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteOrder.isPending}>
                {deleteOrder.isPending ? t('common:saving') : t('common:delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
