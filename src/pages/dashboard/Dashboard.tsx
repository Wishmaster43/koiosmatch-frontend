import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useCandidateCount } from '@/lib/queries'
import { useRightPanel } from '@/context/RightPanelContext'
import { useLookups } from '@/context/LookupsContext'
import { useDashboardData } from './hooks/useDashboardData'
import { interactive } from '@/lib/a11y'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import LineChartCard from '@/components/charts/LineChartCard'
import WeeklyBarChartCard from '@/components/charts/WeeklyBarChartCard'
import FunnelConversion from './blocks/FunnelConversion'
import ShiftsSummary from './blocks/ShiftsSummary'
import TouchpointsFeed from './blocks/TouchpointsFeed'
import AttentionCandidates from './blocks/AttentionCandidates'
import { initialsOf } from '@/lib/initials'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type {
  DashStats, DashOpp, DashData, TimeseriesPoint, TrendRow,
} from '@/types/dashboard'
import { useAllSettings, getJsonSetting, getBoolSetting } from '@/lib/settings/useAllSettings'
import { useNumberFormat } from '@/lib/formatters'
import { visibleBlock, kpiRow } from './templates'
import { buildDashboardKpis } from './dashboardKpis'
import { CheckCircle, AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DashboardType } from './templates'

// Recent lists, AI runs and conversations are now live (GET /dashboard, C-30/C-31).
// The demo placeholder arrays were removed — data is mapped from the endpoint below.

// Turn a backend slug (status/funnel/stage value) into a readable label.
const humanize = (s?: unknown): string =>
  typeof s === 'string' && s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[_-]/g, ' ') : (s == null ? '—' : String(s))

// Compact "when": today → HH:mm, otherwise a short nl-NL date (e.g. "12 jun").
const fmtWhen = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const eur = (v?: unknown) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(v) || 0)

function KpiCard({ label, value, sub, color, bg, Icon, onClick }: {
  label?: ReactNode; value?: ReactNode; sub?: ReactNode; color?: string; bg?: string; Icon: LucideIcon; onClick?: () => void
}) {
  return (
    <div {...interactive(onClick)}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '16px', cursor: onClick ? 'pointer' : 'default', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

// Themed container that hosts a (theme-agnostic) chart card.
function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      {children}
    </div>
  )
}

function Block({ title, action, onAction, children }: { title?: ReactNode; action?: ReactNode; onAction?: () => void; children?: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {action && <span {...interactive(onAction)} style={{ fontSize: 12, color: 'var(--color-primary)', cursor: 'pointer' }}>{action} →</span>}
      </div>
      {children}
    </div>
  )
}

function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  const colors = ['var(--color-primary)','var(--color-secondary)','var(--color-success)','var(--color-warning)','var(--color-danger)','#8B5CF6','#EC4899']
  const color  = colors[initials.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      fontSize: size * 0.36, fontWeight: 700 }}>
      {initials}
    </div>
  )
}

function StatusBadge({ label, color }: { label?: ReactNode; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99,
    background: color + '20', color, whiteSpace: 'nowrap' }}>{label}</span>
}

// Period filter options: backend enum value → Dutch label. Vestiging + status
// options now come live from GET /dashboard (filters.locations / filters.statuses).
const PERIODES: Array<[string, string]> = [
  ['vandaag', 'Vandaag'], ['week', 'Deze week'], ['maand', 'Deze maand'],
  ['kwartaal', 'Dit kwartaal'], ['jaar', 'Dit jaar'],
]

export default function Dashboard({ onNavigate, viewType }: { onNavigate?: (page: string, params?: Record<string, unknown>) => void; viewType?: string }) {
  const { t } = useTranslation('dashboard')
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  const auth = useAuth()
  const { activeTenant } = auth ?? {}
  // The active view/type is chosen in the topbar switcher (DashboardLayout); fall
  // back to the user's own type if rendered standalone. management/'*' = full view.
  const activeType = (viewType ?? auth?.dashboardType?.() ?? 'readonly') as DashboardType
  // Tenant per-role toggles (Settings → Dashboards): a block/KPI is shown if the template
  // allows it AND it is not switched off for this role. Live via the shared settings store.
  const settings = useAllSettings()
  // Deal magnitude in hours instead of euro (Settings → Opportunities → display) — the
  // pipeline KPI must follow the same tenant rule as the opportunities page.
  const valueInHours = getBoolSetting(settings, 'opportunity_value_in_hours', false)
  const hidden = getJsonSetting<Record<string, { kpis?: string[]; blocks?: string[] }>>(settings, 'dashboard_hidden', {})
  const hiddenBlocks = hidden[activeType]?.blocks ?? []
  const hiddenKpis = hidden[activeType]?.kpis ?? []
  // Planning-gated surfaces (Diensten-blok + open-diensten-KPI) only exist when the
  // tenant has the module (Danny 2026-07-04: "Planning staat uit en ik zie DIENSTEN??").
  const hasPlanning = (auth?.hasModule ?? (() => false))('plan')
  const vis = (id: string) => visibleBlock(activeType, id) && !hiddenBlocks.includes(id) && (id !== 'block.shifts' || hasPlanning)

  // Live total — same source as the Candidates table (/candidates meta.total).
  const { data: candidateTotal, isLoading: countLoading } = useCandidateCount()
  const candidateTotalLabel = countLoading ? '…' : formatNumber(candidateTotal ?? 0)

  // Live distributions/counts. /candidates/stats is live; /opportunities/stats
  // is best-effort (renders only if it returns). Defensive field readers mirror
  // the Candidates page (by_status→status, by_funnel→funnel_type, by_owner→owner_id).
  // Topbar filter selections (single-value per dimension server-side) — UI state
  // stays here; ALL server state lives in useDashboardData (audit item 21).
  const [selPeriode,   setSelPeriode]   = useState<string[]>([])
  const [selVestiging, setSelVestiging] = useState<Array<string | number>>([])
  const [selStatus,    setSelStatus]    = useState<string[]>([])
  const dashFilterParams = useMemo(() => {
    const params: Record<string, unknown> = {}
    if (selPeriode[0])   params.period = selPeriode[0]
    if (selStatus[0])    params.status = selStatus[0]
    if (selVestiging[0]) params.location_id = selVestiging[0]
    return params
  }, [selPeriode, selStatus, selVestiging])
  const { stats, opp, dash, dashCharts, matchesTotal, vacanciesTotal } =
    useDashboardData<DashStats, DashOpp, DashData, { timeseries?: Record<string, unknown>; net?: unknown }>({
      tenantId: activeTenant?.id, filterParams: dashFilterParams,
    })

  // Status/funnel labels + colours come from the tenant lookups (NL, configurable)
  // — never humanised backend slugs. Mirrors how the Candidates page renders them.
  const { statusMeta, funnelMeta, funnelTypes } = useLookups()

  // Chart data: [{ name, value, color }] for the shared chart cards.
  const statusData = useMemo(() =>
    (stats?.by_status ?? []).map(o => { const v = o.value ?? o.status; const m = statusMeta(v); return { name: m.label, value: o.count ?? 0, color: m.color, filterValue: v } }).filter(d => d.value) as ChartDatum[], [stats, statusMeta])
  const recruiterData = useMemo(() =>
    (stats?.by_owner ?? []).map(o => ({ name: o.name || '—', value: o.count ?? 0, filterValue: o.id ?? o.owner_id })).filter(d => d.value) as ChartDatum[], [stats])
  // Funnel bars: EVERY lookup phase shows, also at 0 — the count-only mapping hid
  // the new Intake phase entirely (Danny: "intake ontbreekt nog steeds").
  const funnelData = useMemo(() => {
    const counts = new Map((dash?.charts?.by_funnel ?? []).map(o => [String(o.value), o.count ?? 0]))
    return (funnelTypes as Array<{ value: string; label: string; color?: string }>).map(f => ({
      name: f.label, value: counts.get(String(f.value)) ?? 0, color: f.color, filterValue: f.value,
    })) as ChartDatum[]
  }, [dash, funnelTypes])
  const oppStageData = useMemo(() =>
    (opp?.by_stage ?? []).map(o => ({ name: o.label ?? humanize(o.key), value: Number(o.value ?? 0), color: o.color, filterValue: o.key })).filter(d => d.value) as ChartDatum[], [opp])

  // Live feeds from GET /dashboard, mapped to the shapes the lists/charts render.
  // Status/stage labels + colours come from the tenant lookups (never raw slugs).
  const recentCandidates = useMemo(() => (dash?.recent?.candidates ?? []).map(c => {
    const m = statusMeta(c.status_value)
    return { id: c.id, name: c.name, initials: initialsOf(c.name, '–'), role: c.role || '—',
      status: m.label, statusColor: m.color, time: fmtWhen(c.last_activity_at) }
  }), [dash, statusMeta])

  const recentApplications = useMemo(() => (dash?.recent?.applications ?? []).map(a => {
    const m = funnelMeta(a.stage_value)
    return { id: a.id, candidate: a.candidate_name || '—', vacancy: a.vacancy_title || '—',
      status: m.label, statusColor: m.color, time: fmtWhen(a.created_at) }
  }), [dash, funnelMeta])

  const recentLeads = useMemo(() => (dash?.recent?.leads ?? []).map(l => ({
    id: l.id, name: l.name, contact: l.contact_name || '—',
    status: humanize(l.status_value), statusColor: 'var(--color-secondary)', time: fmtWhen(l.created_at),
  })), [dash])

  const runs = useMemo(() => (dash?.ai_runs ?? []).map(r => ({
    name: r.name || '—', time: fmtWhen(r.ran_at), ok: r.ok, n: r.processed, err: r.error,
  })), [dash])

  const conversations = useMemo(() => (dash?.conversations ?? []).map(c => ({
    name: c.name || '—', msg: c.last_message || '', time: fmtWhen(c.at),
  })), [dash])

  // Render the runs/conversations blocks on data presence — the backend already
  // gates these feeds per module (workflows/whatsapp), so this avoids a page-flag
  // mismatch hiding data a role legitimately has.
  const showRuns = runs.length > 0
  const showConv = conversations.length > 0

  // Weekly trend (C-31): merge the three aligned series (same buckets) into one row
  // per period for the grouped bar chart. Only series that have data are rendered.
  const trendData = useMemo<TrendRow[]>(() => {
    // Timeseries from /dashboard AND the dedicated /dashboard/charts endpoint (merged).
    const ts = { ...(dash?.charts?.timeseries ?? {}), ...(dashCharts?.timeseries ?? {}) } as Record<string, TimeseriesPoint[] | undefined> & { out?: Record<string, TimeseriesPoint[]> }
    const byName = new Map<string, TrendRow>()
    const add = (arr: TimeseriesPoint[] | undefined, key: string) => (arr ?? []).forEach(p => {
      const row = byName.get(p.name) ?? { name: p.name }
      row[key] = p.value ?? 0
      // Preserve bucket date boundaries (if the backend provides them) for period-click filtering.
      const pf = p as { from?: unknown; to?: unknown; date?: unknown }
      if (pf.from != null && row.__from == null) row.__from = String(pf.from)
      if (pf.to != null && row.__to == null) row.__to = String(pf.to)
      if (pf.date != null && row.__date == null) row.__date = String(pf.date)
      byName.set(p.name, row)
    })
    add(ts.candidates_in, 'kandidaten')
    add(ts.applications,  'sollicitaties')
    add(ts.matches,       'matches')
    // Outflow (backend charts.timeseries.out.*). Graceful: renders only once delivered.
    const out = ts.out ?? {}
    add(out.candidates_out,        'uitKandidaten')
    add(out.applications_rejected, 'uitAfgewezen')
    add(out.matches_ended,         'uitBeeindigd')
    // Net = inflow − outflow (sibling of timeseries under charts).
    add((dashCharts?.net ?? (dash?.charts as { net?: TimeseriesPoint[] } | undefined)?.net) as TimeseriesPoint[] | undefined, 'netto')
    return [...byName.values()]
  }, [dash, dashCharts])
  const trendSeries = useMemo(() => {
    const present = new Set<string>()
    trendData.forEach(r => Object.keys(r).forEach(k => k !== 'name' && r[k] != null && present.add(k)))
    return [
      { key: 'kandidaten',    label: t('chart.series.candidates'),   color: 'var(--color-primary)' },
      { key: 'sollicitaties', label: t('chart.series.applications'), color: 'var(--color-secondary)' },
      { key: 'matches',       label: t('chart.series.matches'),      color: 'var(--color-accent)' },
      { key: 'uitKandidaten', label: t('chart.series.candidatesOut'),       color: 'var(--color-danger)' },
      { key: 'uitAfgewezen',  label: t('chart.series.applicationsRejected'), color: 'var(--color-warning)' },
      { key: 'uitBeeindigd',  label: t('chart.series.matchesEnded'),         color: '#9CA3AF' },
      { key: 'netto',         label: t('chart.series.net'),                  color: 'var(--text)', line: true },
    ].filter(s => present.has(s.key))
  }, [trendData, t])

  // Attention/metrics merged from every source the backend may use: /candidates/stats
  // `attention`, plus the /dashboard payload (nested `attention` or numeric top-level fields
  // like placements/intakes/wa_queue/incomplete_runs). So delivered metrics light up
  // regardless of exact nesting — no waiting on a path confirmation.
  const att: Record<string, number | null | undefined> = {
    ...(stats?.attention ?? {}),
    ...((dash?.attention as Record<string, number | null | undefined>) ?? {}),
    ...Object.fromEntries(Object.entries(dash ?? {}).filter(([, v]) => typeof v === 'number')) as Record<string, number>,
  }
  const num = (v?: number | null) => (v == null ? '—' : formatNumber(v))
  // Extract the filter value from a clicked chart datum (sector or legend item).
  const fv = (d?: unknown) => {
    const x = d as { filterValue?: unknown; payload?: { filterValue?: unknown } } | null | undefined
    return (x && (x.filterValue ?? x.payload?.filterValue)) || undefined
  }

  const { registerFilters, unregisterFilters } = useRightPanel()

  const filterGroups = useMemo(() => [
    { key: 'periode', label: 'Periode', selected: selPeriode,
      options: PERIODES.map(([value, label]) => ({ value, label })),
      onToggle: (v: string) => setSelPeriode(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'vestiging', label: 'Vestiging', selected: selVestiging,
      options: (dash?.filters?.locations ?? []).map(l => ({ value: l.id, label: l.name })),
      onToggle: (v: string | number) => setSelVestiging(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'kandidaatstatus', label: 'Kandidaatstatus', selected: selStatus,
      options: (dash?.filters?.statuses ?? []).map(s => ({ value: s.value, label: s.label })),
      onToggle: (v: string) => setSelStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [selPeriode, selVestiging, selStatus, dash])

  useEffect(() => {
    registerFilters('dashboard', filterGroups)
    return () => unregisterFilters('dashboard')
  }, [filterGroups, registerFilters, unregisterFilters])

  // WhatsApp backlog + failed (planner/recruiter KPIs); fail-soft 0 without access.
  const incompleteRuns = runs.filter(r => !r.ok).length

  // KPI blocks come from the pure builder (§0.3 size split); KPI_ROWS picks per role.
  const kpiById = buildDashboardKpis({
    t, att, num, eur, opp, valueInHours, candidateTotalLabel,
    matchesTotal, vacanciesTotal, incompleteRuns, conversationsCount: conversations.length, onNavigate,
  })
  // Every role ALWAYS gets its own full KPI row (never hidden).
  const kpis = kpiRow(activeType)
    .filter(id => !hiddenKpis.includes(id))
    // Open-diensten is a Planning-module KPI — hide it when the tenant lacks the module.
    .filter(id => id !== 'openShifts' || hasPlanning)
    .map(id => kpiById[id]).filter(Boolean)

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* Bron-versheid — ShiftManager heeft z'n eigen "Laatste sync" op het SM-dashboard,
          dus hier alleen de overige koppelingen (intus/sdb). Datum in nl-NL (24u). */}
      {(dash?.sync_sources ?? []).filter(s => s.system !== 'shiftmanager').length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          {(dash?.sync_sources ?? []).filter(s => s.system !== 'shiftmanager').map(s => (
            <span key={s.system} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('lastSync', { source: s.label })}: {s.last_synced_at
                ? new Date(s.last_synced_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : t('neverSynced')}
            </span>
          ))}
        </div>
      )}

      {/* KPI-strip — live data */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Verdelings-charts — één auto-flow 2-koloms grid; verborgen charts vallen weg zodat de
          zichtbare (bv. status + funnel bij recruitment) vanzelf naast elkaar komen. */}
      {(vis('chart.status') || vis('chart.recruiter') || vis('chart.funnel') || vis('chart.oppStage')) && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {vis('chart.status') && <Panel><PieChartCard title={t('chart.byStatus')} data={statusData} colors={statusData.map(d => d.color) as string[]} onItemClick={(d) => onNavigate?.('candidates', fv(d) ? { status: fv(d) } : undefined)} /></Panel>}
        {vis('chart.funnel') && <Panel><BarChartCard title={t('chart.funnel')} data={funnelData} colors={funnelData.map(d => d.color) as string[]} showAverage onBarClick={(d) => onNavigate?.('applications', fv(d) ? { stage: fv(d) } : undefined)} /></Panel>}
        {vis('chart.recruiter') && <Panel><PieChartCard title={t('chart.byRecruiter')} data={recruiterData} onItemClick={(d) => onNavigate?.('candidates', fv(d) ? { owner: fv(d) } : undefined)} /></Panel>}
        {vis('chart.oppStage') && <Panel>
          {opp
            ? <PieChartCard title={t('chart.byStage')} data={oppStageData} colors={oppStageData.map(d => d.color) as string[]} onItemClick={(d) => onNavigate?.('opportunities', fv(d) ? { stage: fv(d) } : undefined)} />
            : <LineChartCard title={t('chart.intakeOverTime')} data={[]} unit={t('common:units.candidates')} />}
        </Panel>}
      </div>
      )}

      {/* Wekelijkse instroom — gegroepeerde bar: kandidaten · sollicitaties · matches (C-31). */}
      {/* Instroom (per week) + Funnel-conversie side by side (Danny 2026-07-15):
          equal-width row when both are visible, full-width for whichever remains
          when the other is switched off for this role. */}
      {(vis('chart.weekly') || vis('chart.funnelConversion')) && (
      <div style={{ display: 'grid',
        gridTemplateColumns: (vis('chart.weekly') && vis('chart.funnelConversion')) ? '1fr 1fr' : '1fr',
        gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
        {vis('chart.weekly') && (
        <Panel>
          <WeeklyBarChartCard title={t('chart.intakeWeekly')} data={trendData as unknown as ChartDatum[]} series={trendSeries}
            onBarClick={(row, s) => {
              const r = row as TrendRow & { __from?: string; __to?: string; __date?: string }
              const name = r?.name
              const page = s.key === 'sollicitaties' ? 'applications' : (s.key === 'matches' || s.key === 'uitBeeindigd') ? 'matches' : 'candidates'
              // Turn the clicked bucket into a created-date range when it carries boundaries
              // (explicit from/to, or an ISO-date name treated as a 7-day week).
              const iso = typeof name === 'string' && /^\d{4}-\d{2}-\d{2}/.test(name) ? name.slice(0, 10) : undefined
              const from = r?.__from ?? r?.__date ?? iso
              let to = r?.__to
              if (!to && from) { const d = new Date(from); d.setDate(d.getDate() + 6); to = d.toISOString().slice(0, 10) }
              if (page === 'candidates' && from && to) { onNavigate?.('candidates', { created_between: [from, to] }); return }
              onNavigate?.(page, name ? { period: name } : undefined)
            }} />
        </Panel>
        )}
        {/* Funnel-conversie — % doorstroom per fase (FE-derived); klik → sollicitaties op fase. */}
        {vis('chart.funnelConversion') && (
          <FunnelConversion data={funnelData} onStageClick={(fv) => onNavigate?.('applications', fv ? { stage: fv } : undefined)} />
        )}
      </div>
      )}

      {/* Recruitment-feeds — kandidaat-touchpoints (Vandaag) + kandidaten om af te werken. */}
      {(vis('block.touchpoints') || vis('block.attention')) && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {vis('block.touchpoints') && <TouchpointsFeed items={dash?.touchpoints ?? []} onOpen={(id) => onNavigate?.('candidates', { open: id })} />}
        {vis('block.attention') && <AttentionCandidates groups={dash?.attention_candidates} onOpen={(id) => onNavigate?.('candidates', { open: id })} />}
      </div>
      )}

      {/* Planning-blokken — WhatsApp-wachtrij (🟢) + diensten-overzicht (🟡 tot de feed). */}
      {vis('block.shifts') && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {vis('block.shifts') && <ShiftsSummary open={att.open_shifts} filled={att.filled_shifts} unfilled={att.unfilled_shifts} occupancy={att.occupancy} onOpen={() => onNavigate?.('planning')} />}
      </div>
      )}

      {/* Recente lijsten — demo-data tot er een feed is (B-22/C-30) */}
      {(vis('list.candidates') || vis('list.applications')) && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {vis('list.candidates') && (
        <Block title={t('block.recentCandidates')} action={t('action.allCandidates')} onAction={() => onNavigate?.('candidates')}>
          {recentCandidates.map((c, i) => (
            <div key={i} {...interactive(c.id != null ? () => onNavigate?.('candidates', { open: c.id }) : undefined)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: c.id != null ? 'pointer' : 'default',
              borderBottom: i < recentCandidates.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <Avatar initials={c.initials} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.role}</div>
              </div>
              <StatusBadge label={c.status} color={c.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
            </div>
          ))}
        </Block>
        )}

        {vis('list.applications') && (
        <Block title={t('block.recentApplications')} action={t('action.allApplications')} onAction={() => onNavigate?.('applications')}>
          {recentApplications.map((a, i) => (
            <div key={i} {...interactive(a.id != null ? () => onNavigate?.('applications', { open: a.id }) : undefined)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: a.id != null ? 'pointer' : 'default',
              borderBottom: i < recentApplications.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.candidate}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.vacancy}</div>
              </div>
              <StatusBadge label={a.status} color={a.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </Block>
        )}
      </div>
      )}

      {/* Leads + (AI-runs / conversaties) — getoond op data-aanwezigheid (backend gate't per module) */}
      {(vis('list.leads') || (showRuns && vis('list.runs')) || (showConv && vis('list.conversations'))) && (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${((vis('list.leads') ? 1 : 0) + (showRuns && vis('list.runs') ? 1 : 0) + (showConv && vis('list.conversations') ? 1 : 0)) || 1}, 1fr)`, gap: 16 }}>
        {vis('list.leads') && (
        <Block title={t('block.leadsPipeline')} action={t('action.allCustomers')} onAction={() => onNavigate?.('customers')}>
          {recentLeads.map((l, i) => (
            <div key={i} {...interactive(l.id != null ? () => onNavigate?.('customers', { open: l.id }) : undefined)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: l.id != null ? 'pointer' : 'default',
              borderBottom: i < recentLeads.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.contact}</div>
              </div>
              <StatusBadge label={l.status} color={l.statusColor} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{l.time}</span>
            </div>
          ))}
        </Block>
        )}

        {showRuns && vis('list.runs') && (
          <Block title={t('block.recentRuns')} action={t('action.all')} onAction={() => onNavigate?.('workflows')}>
            {runs.map((r, i) => (
              <div key={i} {...interactive(() => onNavigate?.('workflows'))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
                borderBottom: i < runs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: r.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {r.ok ? <CheckCircle size={13} color="var(--color-success)" /> : <AlertCircle size={13} color="var(--color-danger)" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.ok ? t('run.processed', { count: r.n }) : r.err}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{r.time}</span>
              </div>
            ))}
          </Block>
        )}

        {showConv && vis('list.conversations') && (
          <Block title={t('block.recentConversations')} action={t('action.all')} onAction={() => onNavigate?.('whatsapp', { tab: 'messages' })}>
            {conversations.map((c, i) => (
              <div key={i} {...interactive(() => onNavigate?.('whatsapp', { tab: 'messages' }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer',
                borderBottom: i < conversations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Avatar initials={c.name.split(' ').map(n=>n[0]).join('')} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.msg}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{c.time}</span>
              </div>
            ))}
          </Block>
        )}
      </div>
      )}
    </div>
  )
}
