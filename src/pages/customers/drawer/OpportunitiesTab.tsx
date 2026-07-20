/**
 * OpportunitiesTab — the customer's real Kansen (sales pipeline), NOT a vacancy
 * list (Danny: the old copy/shape "klopt niet" — it rendered vacancy columns under
 * "Open vacatures"). Columns: Titel · Fase (stage soft chip) · Waarde (locale EUR)
 * · Verwachte sluiting. "+ Nieuwe kans" opens AddOpportunityModal prefilled with
 * this customer; a row opens the Kansen page on that record (cross-entity
 * ?open=<id> deep link, mirrors EntityLink); delete asks for confirmation and
 * calls DELETE /opportunities/{id}. The open-flex-shifts section (Planning module)
 * is unrelated to Kansen and stays as its own section below.
 */
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNavigation } from '@/context/NavigationContext'
import { useDateFormat } from '@/lib/datetime'
import { useUsers } from '@/lib/queries'
import { notifyError } from '@/lib/notify'
import api from '@/lib/api'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import SoftChip from '@/components/ui/SoftChip'
import SectionCard from '@/components/ui/SectionCard'
import { useConfirm } from '@/hooks/useConfirm'
import AddOpportunityModal from '@/pages/opportunities/AddOpportunityModal'
import { mapOpportunity } from '@/pages/opportunities/data/mapOpportunity'
import type { Opportunity } from '@/types/opportunity'
import { useCustomerOpenShifts, useCustomerOpportunities } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

const Muted = ({ text }: { text: ReactNode }) => <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>
const money = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

// Section — open flex shifts (planning), only when the tenant has the module.
// Unrelated to the Kansen pipeline; kept here since there is no other tab for it.
function OpenShifts({ customerId }: { customerId?: Id }) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasModule = auth?.hasModule ?? (() => false)
  const { formatDate } = useDateFormat()
  const enabled = hasModule('plan')
  const { rows, loading } = useCustomerOpenShifts(customerId, enabled)

  if (!enabled) return <Muted text={t('opportunities.planningOff')} />
  if (loading)  return <Muted text={t('page.loading')} />
  if (rows.length === 0) return <Muted text={t('opportunities.openShiftsEmpty')} />

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {rows.map((s, i) => (
        <div key={s.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', fontSize: 12,
          borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ width: 78, flexShrink: 0, color: 'var(--text-muted)' }}>{s.date ? formatDate(s.date) : '—'}</span>
          <span style={{ flex: 1, color: 'var(--text)' }}>{[s.shift, s.department].filter(Boolean).join(' · ') || '—'}</span>
        </div>
      ))}
    </div>
  )
}

export default function OpportunitiesTab({ customerId, customerName }: { customerId?: Id; customerName?: string }) {
  const { t } = useTranslation('customers')
  const auth = useAuth()
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  const { openEntity } = useNavigation()
  const { formatDate } = useDateFormat()
  const { data: users = [] } = useUsers() as { data?: { id: Id; name: string }[] }
  const { rows: raw, loading, error, reload } = useCustomerOpportunities(customerId)
  const [adding, setAdding] = useState(false)
  // Edit pencil per row (Danny 2026-07-14): reuses AddOpportunityModal in edit
  // mode (mirrors AddLocationModal doubling as create+edit) — no separate form.
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null)
  const { confirm, dialog } = useConfirm()
  const rows = raw.map(mapOpportunity)

  const remove = (o: Opportunity) => {
    confirm(t('opportunities.deleteConfirm'), () => {
      api.delete(`/opportunities/${o.id}`).then(() => reload()).catch(() => notifyError(t('opportunities.deleteFailed')))
    }, { danger: true })
  }

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: t('opportunities.col.title'), sortable: true, sortValue: o => o.title,
      render: o => <button onClick={() => openEntity('opportunities', o.id)} style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', color: 'var(--color-primary)', cursor: 'pointer', textAlign: 'left' }}>{o.title}</button> },
    { key: 'stage', header: t('opportunities.col.stage'), sortable: true, sortValue: o => o.stage,
      render: o => o.stage ? <SoftChip label={o.stage} color={o.stageColor} /> : '—' },
    { key: 'value', header: t('opportunities.col.value'), align: 'right', cellStyle: { color: 'var(--text)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }, sortable: true,
      sortValue: o => o.value ?? -1, render: o => o.value != null ? money.format(o.value) : '—' },
    { key: 'expectedClose', header: t('opportunities.col.expectedClose'), cellStyle: { color: 'var(--text-muted)', fontSize: 12 }, sortable: true,
      sortValue: o => o.expectedCloseAt ?? '', render: o => o.expectedCloseAt ? formatDate(o.expectedCloseAt) : '—' },
    { key: 'actions', header: '', align: 'right', render: o => (
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button onClick={e => { e.stopPropagation(); setEditingOpp(o) }} title={t('common:edit')}
          style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--text-muted)' }}>
          <Pencil size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); remove(o) }} title={t('common:delete')}
          style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', border: 'none', background: 'var(--bg)', color: 'var(--color-danger)' }}>
          <Trash2 size={12} />
        </button>
      </div>
    ) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title={t('opportunities.title')} action={
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <Plus size={11} /> {t('opportunities.newOpportunity')}
        </button>
      }>
        {error && <Muted text={t('opportunities.loadError')} />}
        {!error && (
          <DataTable columns={columns} rows={rows} loading={loading} loadingText={t('page.loading')} emptyText={t('opportunities.empty')}
            onRowClick={o => openEntity('opportunities', o.id)} />
        )}
      </SectionCard>

      {hasPlanning && (
        <SectionCard title={t('opportunities.openShifts')}>
          <OpenShifts customerId={customerId} />
        </SectionCard>
      )}

      {adding && customerId != null && (
        <AddOpportunityModal
          defaultCustomerId={customerId} customers={[{ id: customerId, name: customerName ?? '' }]} users={users}
          onCreated={() => reload()} onClose={() => setAdding(false)}
        />
      )}

      {/* Edit popup — same modal, edit mode; refetch (matches how this tab loads its data). */}
      {editingOpp && customerId != null && (
        <AddOpportunityModal
          existing={editingOpp}
          defaultCustomerId={customerId} customers={[{ id: customerId, name: customerName ?? '' }]} users={users}
          onCreated={() => reload()} onClose={() => setEditingOpp(null)}
        />
      )}
      {dialog}
    </div>
  )
}
