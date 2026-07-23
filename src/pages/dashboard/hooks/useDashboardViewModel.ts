/**
 * useDashboardViewModel — everything DERIVED from the dashboard's server state (chart
 * series, recent-activity lists, the weekly trend, attention metrics, the per-role KPI
 * row and the block-visibility predicate). Extracted from Dashboard.tsx (§0.3 size
 * split) so the container stays declarative; every computation is verbatim from the
 * original inline useMemo blocks — no behaviour change.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { initialsOf } from '@/lib/initials'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { BarSeries } from '@/components/charts/WeeklyBarChartCard'
import type { DashStats, DashOpp, DashData, TimeseriesPoint, TrendRow } from '@/types/dashboard'
import type { LookupItem } from '@/context/LookupsContext'
import { buildDashboardKpis, type DashboardKpi } from '../dashboardKpis'
import { visibleBlock, kpiRow } from '../templates'
import type { DashboardType } from '../templates'
import { humanize, fmtWhen, eur } from '../dashboardFormat'

interface UseDashboardViewModelArgs {
  t: (key: string) => string
  formatNumber: (v: number) => string
  stats: DashStats | null
  opp: DashOpp | null
  dash: DashData | null
  dashCharts: { timeseries?: Record<string, unknown>; net?: unknown } | null
  statusMeta: (v?: string | null) => LookupItem
  funnelMeta: (v?: string | null) => LookupItem
  funnelTypes: LookupItem[]
  activeType: DashboardType
  hiddenBlocks: string[]
  hiddenKpis: string[]
  hasPlanning: boolean
  valueInHours: boolean
  candidateTotalLabel: ReactNode
  matchesTotal: number | null
  vacanciesTotal: number | null
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}

export function useDashboardViewModel({
  t, formatNumber, stats, opp, dash, dashCharts, statusMeta, funnelMeta, funnelTypes,
  activeType, hiddenBlocks, hiddenKpis, hasPlanning, valueInHours, candidateTotalLabel,
  matchesTotal, vacanciesTotal, onNavigate,
}: UseDashboardViewModelArgs) {
  // Is a chart/list block visible for the active role, and not switched off in Settings?
  const vis = (id: string) => visibleBlock(activeType, id) && !hiddenBlocks.includes(id) && (id !== 'block.shifts' || hasPlanning)

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
  const trendSeries = useMemo<BarSeries[]>(() => {
    const present = new Set<string>()
    trendData.forEach(r => Object.keys(r).forEach(k => k !== 'name' && r[k] != null && present.add(k)))
    return [
      { key: 'kandidaten',    label: t('chart.series.candidates'),   color: 'var(--color-primary)' },
      { key: 'sollicitaties', label: t('chart.series.applications'), color: 'var(--color-secondary)' },
      { key: 'matches',       label: t('chart.series.matches'),      color: 'var(--color-accent)' },
      { key: 'uitKandidaten', label: t('chart.series.candidatesOut'),       color: 'var(--color-danger)' },
      { key: 'uitAfgewezen',  label: t('chart.series.applicationsRejected'), color: 'var(--color-warning)' },
      // eslint-disable-next-line no-restricted-syntax -- DATA: chart series colour (matches-ended, neutral grey), no exact design-token match
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

  // WhatsApp backlog + failed (planner/recruiter KPIs); fail-soft 0 without access.
  const incompleteRuns = runs.filter(r => !r.ok).length

  // KPI blocks come from the pure builder (§0.3 size split); KPI_ROWS picks per role.
  const kpiById = buildDashboardKpis({
    t, att, num, eur, opp, valueInHours, candidateTotalLabel,
    matchesTotal, vacanciesTotal, incompleteRuns, conversationsCount: conversations.length, onNavigate,
  })
  // Every role ALWAYS gets its own full KPI row (never hidden).
  const kpis: DashboardKpi[] = kpiRow(activeType)
    .filter(id => !hiddenKpis.includes(id))
    // Open-diensten is a Planning-module KPI — hide it when the tenant lacks the module.
    .filter(id => id !== 'openShifts' || hasPlanning)
    .map(id => kpiById[id]).filter(Boolean)

  return {
    vis, statusData, recruiterData, funnelData, oppStageData,
    recentCandidates, recentApplications, recentLeads, runs, conversations,
    showRuns, showConv, trendData, trendSeries, att, kpis,
  }
}

// Convenience alias for block components — exact shape returned above.
export type DashboardViewModel = ReturnType<typeof useDashboardViewModel>
