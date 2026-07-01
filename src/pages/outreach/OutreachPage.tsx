/**
 * OutreachPage — route page for the call lists ("bellijsten"). Follows the entity
 * blueprint (CLAUDE §3A) and mirrors the Opportunities page: an InsightsRow
 * (donuts + KPIs, click-to-filter), a toolbar with the create button on the LEFT
 * and an archived text-toggle + table/board view toggle on the RIGHT, a bulk bar
 * over the table, and a kanban board. The per-bellijst call-list detail is step 2.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutList, Kanban, Archive, Plus } from 'lucide-react'
import { notifyError, notifySuccess } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { useOutreachCampaigns } from './hooks/useOutreachCampaigns'
import type { Campaign } from './hooks/useOutreachCampaigns'
import { listCampaigns, updateCampaign, deleteCampaign } from './data/outreachApi'
import OutreachList from './OutreachList'
import OutreachBoard from './OutreachBoard'
import OutreachBulkBar from './OutreachBulkBar'
import OutreachCreate from './OutreachCreate'

// Fixed status enum (not a tenant lookup) → board columns, donut + colours (hex for the chart).
const STATUSES = [
  { key: 'draft',  color: '#9CA3AF' },
  { key: 'active', color: '#16A34A' },
  { key: 'done',   color: '#2563EB' },
]
const CHANNELS = [
  { key: 'call',     color: '#2563EB' },
  { key: 'email',    color: '#D97706' },
  { key: 'whatsapp', color: '#25D366' },
]

const statusKey  = (c: Campaign) => c.status ?? 'draft'
const channelKey = (c: Campaign) => c.channel ?? 'call'
const targetsOf  = (c: Campaign) => c.targets_count ?? c.target_count ?? 0

export default function OutreachPage() {
  const { t } = useTranslation('outreach')
  const auth = useAuth()
  const canArchive = (auth as unknown as { hasPermission?: (p: string) => boolean })?.hasPermission?.('outreach.delete') ?? false
  const { campaigns, loading, error, reload, add, patch, drop } = useOutreachCampaigns()

  const [view, setView] = useState<'table' | 'board'>('table')
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  // KPI/donut click-to-filter (status) + checkbox selection.
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  // Archived campaigns are fetched lazily (only while the archived toggle is on).
  const [archived, setArchived] = useState<Campaign[]>([])
  const [archLoading, setArchLoading] = useState(false)
  const [archError, setArchError] = useState(false)
  useEffect(() => {
    if (!showArchived) return
    setArchLoading(true); setArchError(false)
    listCampaigns({ archived: 1 })
      .then((res) => setArchived((res.rows as Campaign[]) ?? []))
      .catch(() => setArchError(true))
      .finally(() => setArchLoading(false))
  }, [showArchived])

  // Clear the selection whenever the filter/view/archived toggle changes.
  useEffect(() => { setSelectedIds(new Set()) }, [selectedStatus, view, showArchived])

  // Board columns + donut items, labelled via i18n.
  const columns = useMemo(() => STATUSES.map((s) => ({ key: s.key, label: t(`status.${s.key}`), color: s.color })), [t])
  const donutBy = (defs: { key: string; color: string }[], ns: string, keyOf: (c: Campaign) => string) => defs
    .map((d) => ({ name: t(`${ns}.${d.key}`), key: d.key, color: d.color, value: campaigns.filter((c) => keyOf(c) === d.key).length }))
    .filter((d) => d.value > 0)
  const statusData  = useMemo(() => donutBy(STATUSES, 'status', statusKey), [campaigns, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const channelData = useMemo(() => donutBy(CHANNELS, 'channel', channelKey), [campaigns, t]) // eslint-disable-line react-hooks/exhaustive-deps

  // Base rows = active list, or the archived list when the archived toggle is on.
  const baseRows = showArchived ? archived : campaigns
  // Status filter (from the donut/KPI) narrows both the table and the board.
  const filtered = useMemo(() =>
    selectedStatus.length ? baseRows.filter((c) => selectedStatus.includes(statusKey(c))) : baseRows
  , [baseRows, selectedStatus])

  // Donut/KPI click = set exactly one status value (or clear when clicked again).
  const pickStatus = (v?: string) => { if (v != null) setSelectedStatus((p) => (p.length === 1 && p[0] === v) ? [] : [v]) }

  // ── Insights: 2 donuts (status/channel, filterable) + 3 KPI cards ──
  const insightDonuts: DonutSpec[] = [
    { key: 'status',  title: t('insights.status'),  data: statusData,  onPick: (d) => pickStatus((d as { key?: string })?.key), active: selectedStatus.length > 0, onClear: () => setSelectedStatus([]) },
    { key: 'channel', title: t('insights.channel'), data: channelData },
  ]
  const insightKpis: KpiSpec[] = [
    { key: 'total',   label: t('kpi.total'),   value: campaigns.length,                                          sub: t('kpi.totalSub') },
    { key: 'active',  label: t('kpi.active'),  value: campaigns.filter((c) => statusKey(c) === 'active').length, sub: t('kpi.activeSub'), color: '#16A34A',
      onClick: () => pickStatus('active'), active: selectedStatus.length === 1 && selectedStatus[0] === 'active' },
    { key: 'targets', label: t('kpi.targets'), value: campaigns.reduce((n, c) => n + targetsOf(c), 0),           sub: t('kpi.targetsSub'), color: 'var(--color-primary)' },
  ]

  // Kanban drag = a status-only update (optimistic; revert via reload on failure).
  const handleMove = (id: string, status: string) => {
    patch(id, { status })
    updateCampaign(id, { status }).catch(() => { notifyError(t('moveError')); reload() })
  }

  // ── Bulk selection + mutations (active table only) ──
  const toggleRow = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (ids: string[], allSelected: boolean) => setSelectedIds((prev) => { const n = new Set(prev); ids.forEach((i) => allSelected ? n.delete(i) : n.add(i)); return n })
  // Bulk set status: optimistic patch + PATCH each (no dedicated bulk endpoint needed).
  const bulkSetStatus = async (status: string) => {
    const ids = [...selectedIds]; if (!ids.length) return
    setSelectedIds(new Set())
    ids.forEach((id) => patch(id, { status }))
    const results = await Promise.allSettled(ids.map((id) => updateCampaign(id, { status })))
    if (results.some((r) => r.status === 'rejected')) { notifyError(t('bulk.mutateError')); reload() }
    else notifySuccess(t('bulk.done', { count: ids.length }))
  }
  // Bulk archive (soft-delete via DELETE); drop the rows optimistically.
  const bulkArchive = async () => {
    const ids = [...selectedIds]; if (!ids.length) return
    setSelectedIds(new Set())
    ids.forEach((id) => drop(id))
    const results = await Promise.allSettled(ids.map((id) => deleteCampaign(id)))
    if (results.some((r) => r.status === 'rejected')) { notifyError(t('bulk.archiveError')); reload() }
    else notifySuccess(t('bulk.done', { count: ids.length }))
  }

  // Create view replaces everything (inline, no modal).
  if (creating) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <OutreachCreate onBack={() => setCreating(false)} onCreated={add} />
      </div>
    )
  }

  // View-toggle icon button styling.
  const iconBtn = (active: boolean) => ({
    padding: 6, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', display: 'flex',
    background: active ? 'var(--color-primary)' : 'var(--surface)', color: active ? '#fff' : 'var(--text)',
  })

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Insights strip (donuts + KPIs) */}
        <InsightsRow donuts={insightDonuts} kpis={insightKpis} clearTitle={t('insights.clearFilter')} />

        {/* Toolbar — create on the LEFT, archived toggle + view toggle on the RIGHT (mirror Opportunities) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', background: 'var(--bg)', flexShrink: 0 }}>
          <button onClick={() => setCreating(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff' }}>
            <Plus size={15} /> {t('new')}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Archived (soft-deleted) toggle */}
            <button onClick={() => setShowArchived((v) => !v)} title={t('view.archived')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: showArchived ? 600 : 500, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${showArchived ? 'var(--color-primary)' : 'var(--border)'}`,
                background: showArchived ? 'var(--color-primary-bg)' : 'var(--surface)',
                color: showArchived ? 'var(--color-primary)' : 'var(--text)' }}>
              <Archive size={14} /> {t('view.archived')}
            </button>
            {/* Table / board view toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setView('table')} title={t('view.table')} aria-label={t('view.table')} style={iconBtn(view === 'table')}><LayoutList size={16} /></button>
              <button onClick={() => setView('board')} title={t('view.board')} aria-label={t('view.board')} style={iconBtn(view === 'board')}><Kanban size={16} /></button>
            </div>
          </div>
        </div>

        {/* Bulk action bar — active table view only, when ≥1 row is selected */}
        {view === 'table' && !showArchived && selectedIds.size > 0 && (
          <div style={{ padding: '8px 24px', flexShrink: 0 }}>
            <OutreachBulkBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}
              onSetStatus={bulkSetStatus} onArchive={bulkArchive} canArchive={canArchive}
              statuses={columns.map((c) => ({ value: c.key, label: c.label, color: c.color }))} />
          </div>
        )}

        {/* Content */}
        {view === 'board' ? (
          <OutreachBoard rows={filtered} columns={columns} onMove={handleMove} />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            <OutreachList
              campaigns={filtered}
              loading={showArchived ? archLoading : loading}
              error={showArchived ? archError : error}
              onReload={showArchived ? () => setShowArchived(true) : reload}
              emptyText={showArchived ? t('archivedEmpty') : undefined}
              selectable={!showArchived}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
            />
          </div>
        )}
      </div>
    </div>
  )
}
