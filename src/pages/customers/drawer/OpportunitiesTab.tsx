/**
 * OpportunitiesTab — the customer's real Kansen (sales pipeline), NOT a vacancy
 * list (Danny: the old copy/shape "klopt niet" — it rendered vacancy columns under
 * "Open vacatures"). Columns: Titel · Fase (stage soft chip) · Waarde (locale EUR)
 * · Verwachte sluiting. "+ Nieuwe kans" opens AddOpportunityModal prefilled with
 * this customer; a row opens the Kansen page on that record (cross-entity
 * ?open=<id> deep link, mirrors EntityLink); delete asks for confirmation and
 * calls DELETE /opportunities/{id}. The open-flex-shifts section (Planning module)
 * is unrelated to Kansen and stays as its own section below.
 *
 * Same drill-down treatment as Locaties/Afdelingen/Contactpersonen (Danny: "bij
 * Kansen mis ik ook nog de statussen"): a stage filter via the shared
 * StatusFilterSelect/useStatusFilter (an opportunity has no separate status axis,
 * only `stage` — the vocabulary this filter narrows on, never a status field the
 * API does not return) and a colour-on/off toggle for the stage chip, mirroring
 * `customer_department_table_color_status`.
 */
import type { ReactNode } from 'react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil, Search } from 'lucide-react'
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
// House "+ action" trigger (Danny 27-07: "moet een knopje zijn zoals ook bij de
// kandidaat drill down") — replaces the bare text+Plus button below.
import DrawerAddButton from '@/components/drawer/DrawerAddButton'
import AddOpportunityModal from '@/pages/opportunities/AddOpportunityModal'
import { mapOpportunity } from '@/pages/opportunities/data/mapOpportunity'
import { useOpportunityStages } from '@/lib/useOpportunityStages'
import StatusFilterSelect, { useStatusFilter } from '@/components/drawer/StatusFilterSelect'
import { useAllSettings, getBoolSetting } from '@/lib/settings/useAllSettings'
import type { Opportunity } from '@/types/opportunity'
import { useCustomerOpenShifts, useCustomerOpportunities } from '../hooks/useCustomerDrawerData'
import type { Id } from '@/types/common'

const Muted = ({ text }: { text: ReactNode }) => <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{text}</div>
const money = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
// Plain-text fallback style for the stage chip toggled off (CHIPKLEUR-INSTELBAAR-1) —
// mirrors the `plainCell` convention in DepartmentsPanel/LocationsTab.
const plainCell = { color: 'var(--text)', fontSize: 12 }

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
  const allRows = raw.map(mapOpportunity)

  // Stage filter — same shared component/hook as Locaties/Afdelingen/Contactpersonen
  // (StatusFilterSelect.tsx), keyed off `stageValue` since an opportunity has no
  // separate status axis, only a pipeline stage.
  const { stages } = useOpportunityStages()
  const { value: stageFilter, toggle: toggleStage, filtered: stageRows } =
    useStatusFilter(allRows, stages, o => String(o.stageValue ?? ''))

  // Free-text search (Danny 03-08: "bij Kansen-tabblad op hoofd-drilldown mis ik
  // ook zoekbalk") — narrows on the opportunity title, the same field the title
  // column itself renders, on top of the stage filter's rows.
  const [search, setSearch] = useState('')
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? stageRows.filter(o => String(o.title ?? '').toLowerCase().includes(q)) : stageRows
  }, [stageRows, search])

  // Colour-on/off flag for the stage column (CHIPKLEUR-INSTELBAAR-1) — defaults ON,
  // so an absent setting keeps today's coloured-chip look.
  const settings = useAllSettings()
  const colorStage = getBoolSetting(settings, 'customer_opportunity_table_color_stage', true)

  const remove = (o: Opportunity) => {
    confirm(t('opportunities.deleteConfirm'), () => {
      api.delete(`/opportunities/${o.id}`).then(() => reload()).catch(() => notifyError(t('opportunities.deleteFailed')))
    }, { danger: true })
  }

  const columns: Column<Opportunity>[] = [
    { key: 'title', header: t('opportunities.col.title'), sortable: true, sortValue: o => o.title,
      render: o => <button onClick={() => openEntity('opportunities', o.id)} style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', color: 'var(--color-primary)', cursor: 'pointer', textAlign: 'left' }}>{o.title}</button> },
    { key: 'stage', header: t('opportunities.col.stage'), sortable: true, sortValue: o => o.stage,
      render: o => !o.stage ? '—' : colorStage
        ? <SoftChip label={o.stage} color={o.stageColor} />
        : <span style={plainCell}>{o.stage}</span> },
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
      {/* No section title (Danny 05-08 "woord kansen links kan weg"): the tab bar already
          names this section, and the freed width goes to the search bar — mirrors how the
          Locaties/Afdelingen toolbars start straight with search. */}
      <SectionCard action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          {/* Toolbar in the house order (mirrors Vacatures/Locaties/…): search
              left (growing), stage filter middle, add trigger last. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px',
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <Search size={13} color="var(--text-muted)" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('opportunities.searchPlaceholder')} aria-label={t('opportunities.searchPlaceholder')}
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'var(--text)', minWidth: 0 }} />
          </div>
          {/* Options key on the stage VALUE slug (not the lookup's id) — an opportunity
              row only ever carries `stageValue`, never a stage id (§3B, no invented axis). */}
          <StatusFilterSelect value={stageFilter} onToggle={toggleStage} statuses={stages}
            optionKey={s => String(s.value ?? s.id ?? '')} />
          {/* DRAWER-ADD-SHORT-1 (Danny 05-08): short in this drawer sub-tab's toolbar. */}
          <DrawerAddButton onClick={() => setAdding(true)} label={t('opportunities.newOpportunity')} short />
        </div>
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
