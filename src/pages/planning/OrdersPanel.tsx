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
import { useAuth } from '@/context/AuthContext'
import { usePlanningOrdersList, useDeletePlanningOrder } from './hooks/usePlanningOrders'
import type { PlanningOrderRow } from './hooks/usePlanningOrders'
import AddOrderModal from './AddOrderModal'
import { extractApiError } from '@/lib/extractApiError'
import Button from '@/components/ui/Button'
import SoftChip from '@/components/ui/SoftChip'
import { PageTitle, SectionTitle, Caption } from '@/components/ui/typography'
import { tintBorder } from '@/lib/tint'

// Planning orders list + create/edit/delete, entirely real data (see the module doc comment above).
export default function OrdersPanel() {
  const { t } = useTranslation('planning')
  // RIGHTS-GATE-OPENERS-1: mirrors planning.create permission (backend:
  // pools.php:127 POST /planning/orders) — hidden without it, never a dead button (§3).
  const auth = useAuth()
  const canCreate = auth?.hasPermission?.('planning.create') ?? false
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
        <PageTitle as="span" style={{ flex: 1 }}>{t('order.listTitle')}</PageTitle>
        {canCreate && (
          <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> {t('order.addOrder')}
          </Button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Four UI states — no fabricated rows (§0: an honest empty, never invented demo data). */}
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('common:loading')}</div>
        )}
        {!loading && error && (
          <div role="alert" style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--color-danger-text)' }}>{t('order.errorList')}</div>
        )}
        {!loading && !error && orders.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <ClipboardList size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
            <SectionTitle style={{ textAlign: 'center' }}>{t('order.empty')}</SectionTitle>
            <Caption style={{ marginTop: 4, display: 'block' }}>{t('order.emptyHint')}</Caption>
          </div>
        )}
        {!loading && !error && orders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.map(o => (
              <div key={String(o.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SectionTitle style={{ marginBottom: 0 }}>
                    {o.subject || o.function || o.reference || t('order.listTitle')}
                  </SectionTitle>
                  <Caption style={{ marginTop: 2, display: 'block' }}>
                    {[o.client, o.location, o.department].filter(Boolean).join(' — ') || '—'}
                  </Caption>
                </div>
                <SoftChip label={t(`order.status.${o.status}`, o.status)} color="var(--color-primary)" />
                <Caption>
                  {t('order.shiftsCount', { count: o.shifts_count ?? 0 })}
                </Caption>
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 'var(--z-confirm)' }}>
          <div style={{ width: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('order.deleteConfirmTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{t('order.deleteConfirmBody')}</div>
            {deleteError && (
              <div role="alert" style={{ padding: '8px 10px', fontSize: 12, borderRadius: 8, marginBottom: 12,
                color: 'var(--color-on-danger-bg)', background: 'var(--color-danger-bg)',
                border: `1px solid ${tintBorder('var(--color-danger)')}` }}>
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
