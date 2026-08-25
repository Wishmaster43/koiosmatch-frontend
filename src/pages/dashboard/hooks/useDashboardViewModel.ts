/**
 * useDashboardViewModel — everything DERIVED from the dashboard's server state (chart
 * series, recent-activity lists, the weekly trend, attention metrics, the per-role KPI
 * row and the block-visibility predicate). Extracted from Dashboard.tsx (§0.3 size
 * split) so the container stays declarative; every computation is verbatim from the
 * original inline useMemo blocks — no behaviour change.
 */
import { useMemo } from 'react'
import { useDateFormat } from '@/lib/datetime'
import { initialsOf } from '@/lib/initials'
import { useSeedLabel } from '@/lib/useSeedLabel'
import type { ChartDatum } from '@/components/charts/chartTypes'
import type { BarSeries } from '@/components/charts/WeeklyBarChartCard'
import type { DashStats, DashOpp, DashData, TimeseriesPoint, TrendRow } from '@/types/dashboard'
import type { LookupItem } from '@/context/LookupsContext'
import { buildDashboardKpis, type DashboardKpi } from '../dashboardKpis'
import { serverKeysToLocal, apiRoleForType } from '../kpiKeyMap'
import { visibleBlock, kpiRow, PLANNING_BLOCKS } from '../templates'
import type { DashboardType } from '../templates'
import { humanize, fmtWhen, eur } from '../dashboardFormat'
// DASH-VOLGORDE-1: reuse the reports domain's pure order-resolver (§2 public surface)
// instead of duplicating its unknown-id-drops/backfill logic for the KPI row.
import { resolveReportKpiOrder } from '@/pages/reports/shared'

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
  // DASH-VOLGORDE-1 — per-role KPI tile order (Settings → Dashboards → Volgorde),
  // { [dashboardType]: string[] of kpi ids }. Absent/unknown ids are dropped by
  // the resolver, never rendered as a blank tile. Optional (defaults to {} =
  // today's default order) so existing test/call sites keep compiling.
  kpiOrder?: Record<string, string[]>
  hasPlanning: boolean
  valueInHours: boolean
  onNavigate?: (page: string, params?: Record<string, unknown>) => void
}

export function useDashboardViewModel({
  t, formatNumber, stats, opp, dash, dashCharts, statusMeta, funnelMeta, funnelTypes,
  activeType, hiddenBlocks, hiddenKpis, kpiOrder = {}, hasPlanning, valueInHours,
  onNavigate,
}: UseDashboardViewModelArgs) {
  // The feed timestamps carry a month NAME on any day but today, so they follow the
  // app language (DATUM-1 keeps the numeric halves language-independent by itself).
  const { locale } = useDateFormat()
  // LOOKUP-I18N-1: seeded tenant-lookup labels render in the user's language;
  // a tenant rename/creation passes through untouched.
  const seedLabel = useSeedLabel()

  // Is a chart/list block visible for the active role, and not switched off in Settings?
  // K-173 fase 6 — every planning-gated block (shifts + the five v3 planning
  // feeds) shares one gate (PLANNING_BLOCKS), not a single 'block.shifts' literal.
  const vis = (id: string) => visibleBlock(activeType, id) && !hiddenBlocks.includes(id) && (!PLANNING_BLOCKS.has(id) || hasPlanning)

  // Chart data: [{ name, value, color }] for the shared chart cards. LOOKUP-I18N-1:
  // `name` (display) runs through seedLabel; `filterValue` stays the raw lookup
  // value so a donut click still filters on it, never on the translated text.
  const statusData = useMemo(() =>
    (stats?.by_status ?? []).map(o => { const v = o.value ?? o.status; const m = statusMeta(v); return { name: seedLabel('statuses', { value: v, label: m.label }), value: o.count ?? 0, color: m.color, filterValue: v } }).filter(d => d.value) as ChartDatum[], [stats, statusMeta, seedLabel])
  const recruiterData = useMemo(() =>
    (stats?.by_owner ?? []).map(o => ({ name: o.name || '—', value: o.count ?? 0, filterValue: o.id ?? o.owner_id })).filter(d => d.value) as ChartDatum[], [stats])
  // Funnel bars: EVERY lookup phase shows, also at 0 — the count-only mapping hid
  // the new Intake phase entirely (Danny: "intake ontbreekt nog steeds").
  const funnelData = useMemo(() => {
    const counts = new Map((dash?.charts?.by_funnel ?? []).map(o => [String(o.value), o.count ?? 0]))
    return (funnelTypes as Array<{ value: string; label: string; color?: string }>).map(f => ({
      name: seedLabel('funnelTypes', { value: f.value, label: f.label }), value: counts.get(String(f.value)) ?? 0, color: f.color, filterValue: f.value,
    })) as ChartDatum[]
  }, [dash, funnelTypes, seedLabel])
  const oppStageData = useMemo(() =>
    (opp?.by_stage ?? []).map(o => { const label = o.label ?? humanize(o.key); return { name: seedLabel('opportunityStages', { value: o.key, label }), value: Number(o.value ?? 0), color: o.color, filterValue: o.key } }).filter(d => d.value) as ChartDatum[], [opp, seedLabel])

  // Live feeds from GET /dashboard, mapped to the shapes the lists/charts render.
  // Status/stage labels + colours come from the tenant lookups (never raw slugs);
  // LOOKUP-I18N-1 translates the seeded default, a tenant rename passes through.
  const recentCandidates = useMemo(() => (dash?.recent?.candidates ?? []).map(c => {
    const m = statusMeta(c.status_value)
    return { id: c.id, name: c.name, initials: initialsOf(c.name, '–'), role: c.role || '—',
      status: seedLabel('statuses', { value: c.status_value, label: m.label }), statusColor: m.color, time: fmtWhen(c.last_activity_at, locale) }
  }), [dash, statusMeta, seedLabel, locale])

  const recentApplications = useMemo(() => (dash?.recent?.applications ?? []).map(a => {
    const m = funnelMeta(a.stage_value)
    return { id: a.id, candidate: a.candidate_name || '—', vacancy: a.vacancy_title || '—',
      status: seedLabel('funnelTypes', { value: a.stage_value, label: m.label }), statusColor: m.color, time: fmtWhen(a.created_at, locale) }
  }), [dash, funnelMeta, seedLabel, locale])

  // KD11 (DASHP36) — the three sales-dashboard widget feeds, mapped to the shared
  // WidgetListBlock row shape. Each self-hides via WidgetListBlock when empty; the
  // feed itself is absent (not `[]`) for a role without the view-permission, so
  // `?? []` here just means "nothing to show", never a fabricated zero-state.
  const expiringMatchesRows = useMemo(() => (dash?.expiring_matches ?? []).map(m => ({
    key: m.id ?? `${m.candidate_id}-${m.customer_id}`,
    // candidate_name is PII and `null` without candidates.view (DASHP36) — fall
    // back to the customer so the row still means something, never blank.
    primary: m.candidate_name || m.customer_name || '—',
    secondary: m.candidate_name ? m.customer_name : undefined,
    meta: fmtWhen(m.end_date, locale),
    onClick: m.id != null ? () => onNavigate?.('matches', { open: m.id }) : undefined,
  })), [dash, onNavigate, locale])

  const staleVacanciesRows = useMemo(() => (dash?.stale_vacancies ?? []).map((v, i) => ({
    key: v.id ?? v.title ?? `row-${i}`,
    primary: v.title || '—',
    meta: fmtWhen(v.published_at, locale),
    onClick: v.id != null ? () => onNavigate?.('vacancies', { open: v.id }) : undefined,
  })), [dash, onNavigate, locale])

  const koiosSuggestionsRows = useMemo(() => (dash?.koios_suggestions ?? []).map((s, i) => ({
    key: s.vacancy_id ?? s.vacancy_title ?? `row-${i}`,
    primary: s.vacancy_title || '—',
    meta: s.suggestions_count != null ? formatNumber(s.suggestions_count) : undefined,
    onClick: s.vacancy_id != null ? () => onNavigate?.('vacancies', { open: s.vacancy_id }) : undefined,
  })), [dash, onNavigate, formatNumber])

  // customersByOwnerRows moved to blocks/sales/CustomersByOwnerDonut.tsx
  // (DASH-FEEDS-PACK-1 / feedRegistry), which reads dash.customers_by_owner directly.

  const recentLeads = useMemo(() => (dash?.recent?.leads ?? []).map(l => ({
    id: l.id, name: l.name, contact: l.contact_name || '—',
    status: humanize(l.status_value), statusColor: 'var(--color-secondary)', time: fmtWhen(l.created_at, locale),
  })), [dash, locale])

  const runs = useMemo(() => (dash?.ai_runs ?? []).map(r => ({
    name: r.name ? seedLabel('workflowNames', { label: r.name }) : '—', time: fmtWhen(r.ran_at, locale), ok: r.ok, n: r.processed, err: r.error,
  })), [dash, seedLabel, locale])

  const conversations = useMemo(() => (dash?.conversations ?? []).map(c => ({
    name: c.name || '—', msg: c.last_message || '', time: fmtWhen(c.at, locale),
  })), [dash, locale])

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
      // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
      { key: 'uitKandidaten', label: t('chart.series.candidatesOut'),       color: 'var(--color-danger)' },
      { key: 'uitAfgewezen',  label: t('chart.series.applicationsRejected'), color: 'var(--color-warning)' },
      // eslint-disable-next-line no-restricted-syntax -- DATA: chart series colour (matches-ended, neutral grey), no exact design-token match
      { key: 'uitBeeindigd',  label: t('chart.series.matchesEnded'),         color: '#9CA3AF' },
      { key: 'netto',         label: t('chart.series.net'),                  color: 'var(--text)', line: true },
    ].filter(s => present.has(s.key))
  }, [trendData, t])

  const num = (v?: number | null) => (v == null ? '—' : formatNumber(v))

  // K1 (DASH-KPI-SERVER-FE-1) — the server-computed KPI block (K-168). Falls
  // back to {} for an old server response without `kpis` so every tile just
  // renders '—' instead of crashing.
  const kpis = dash?.kpis ?? {}

  // KPI blocks come from the pure builder (§0.3 size split); KPI_ROWS picks per role.
  // K-173 fase 2 — dash.drills flows straight through so each tile can resolve its
  // own onClick against the server's exact list filters (see buildDashboardKpis).
  const kpiById = buildDashboardKpis({
    t, kpis, drills: dash?.drills, num, eur, opp, valueInHours, onNavigate,
  })
  // MODULE-gated tiles render NOTHING when their server key is ABSENT: K-168
  // only omits a key when the tenant lacks the module behind it (workflows /
  // planning) — every rights-gated key is always present and carries null
  // ("geen recht" → '—' via num()), so presence-gating those would never fire.
  // The old D6 hide-on-absent tiles (tooLongInStage/missingApptApps/missingDocs)
  // therefore now show an honest '—' for a viewer without the right.
  const REQUIRES_KPI_KEY: Record<string, string> = {
    incompleteRuns: 'incomplete_runs',
    openShifts: 'open_shifts',
    occupancy: 'occupancy',
    messagesSent: 'messages_sent',
    shiftsPlanned: 'shifts_planned',
    // DASH-V3-UITROL-1 — the four shift keys + open_shifts_48h are ABSENT
    // (not null) without the planning module, per K-179's contract.
    openShifts48h:     'open_shifts_48h',
    shiftsUnconfirmed: 'shifts_unconfirmed',
    shiftsNoshowToday: 'shifts_noshow_today',
    shiftsCancelledToday: 'shifts_cancelled_today',
  }
  // Every role ALWAYS gets its own full KPI row (never hidden), just possibly reordered.
  // K-173 kpi_row (714eae01): when the server sends the viewer-effective ordered
  // row (server keys; presence = visible, position = order — fed by Settings →
  // Dashboards through PUT /dashboard/kpis/{role}), THAT is the one truth: the
  // settings-blob hidden/order path only serves older servers without it. The
  // module gates still apply on top — a stored row must never resurrect a tile
  // whose module key is absent.
  // The server row describes the VIEWER's role. When a super-view user switches
  // the dashboard to another type (Danny: badge said Admin while viewing
  // Management), a row for a different api-role must not masquerade as that
  // view's row — fall back to the type's template then (or the preview_role
  // response, whose scope.role mirrors the viewed role).
  const serverRole = dash?.scope?.role != null ? apiRoleForType(String(dash.scope.role)) : null
  const serverRowApplies = serverRole == null || serverRole === apiRoleForType(activeType)
  const serverRow = serverRowApplies && dash?.kpi_row ? serverKeysToLocal(dash.kpi_row) : null
  const baseKpiIds = serverRow ?? kpiRow(activeType).filter(id => !hiddenKpis.includes(id))
  const visibleKpiIds = baseKpiIds
    // Open-diensten is a Planning-module KPI — hide it when the tenant lacks the module.
    .filter(id => (id !== 'openShifts' && id !== 'shiftsPlanned') || hasPlanning)
    .filter(id => !(id in REQUIRES_KPI_KEY) || REQUIRES_KPI_KEY[id] in kpis)
  // DASH-VOLGORDE-1 — legacy path only: apply the blob's stored order on top of
  // the visible set (the server row is already ordered).
  const { order: orderedKpiIds } = serverRow
    ? { order: visibleKpiIds }
    : resolveReportKpiOrder(kpiOrder[activeType], visibleKpiIds, visibleKpiIds)
  const kpiCards: DashboardKpi[] = orderedKpiIds.map(id => kpiById[id]).filter(Boolean)

  // Shifts block values (K-168 module keys) — handed out here so the page has
  // ONE read path for server KPI values (§3: logic in hooks, not in JSX).
  const shifts = { open: kpis.open_shifts ?? null, occupancy: kpis.occupancy ?? null }

  // K-173 fase 1 — the resolved scope, passed through verbatim; the badge/footnote
  // render only when it is present (older server = no badge, never a fake one).
  const scope = dash?.scope ?? null

  // K-173 fase 6 — recruitment_manager team-load rows, aflopend zoals geleverd
  // (server already sorts; no client re-sort so its order stays authoritative).
  const recruiterLoadRows = dash?.recruiter_load ?? []
  // K-173 fase 6 — sales_manager/accountmanager opportunity-ageing buckets.
  const oppAgingRows = dash?.opp_aging ?? []

  return {
    vis, statusData, recruiterData, funnelData, oppStageData,
    recentCandidates, recentApplications, recentLeads, runs, conversations,
    showRuns, showConv, trendData, trendSeries, shifts, kpis: kpiCards, scope,
    // KD11 widget feeds (DASHP36).
    expiringMatchesRows, staleVacanciesRows, koiosSuggestionsRows,
    // K-173 fase 6 feeds.
    recruiterLoadRows, oppAgingRows,
  }
}

// Convenience alias for block components — exact shape returned above.
export type DashboardViewModel = ReturnType<typeof useDashboardViewModel>
