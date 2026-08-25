/**
 * CustomersReport — customers INFLOW report (GET /reports/customers, RAPPORTEN-SUITE-1
 * "portie 3"). Mirrors CandidatesReport/ApplicationsReport 1:1 (same envelope family,
 * wave-2 chart mix: status/phase as donuts in their lookup colours, rankings as
 * bar charts, the timeseries line full width — every click keeps its drill): the window
 * is rendered PROMINENTLY since this report is windowed on customers.created_at while
 * the customers LIST is not. Leads live on `by_phase` (flag-driven is_customer, NOT a
 * 'prospect' status string — PROSPECT-DEDUP-1 retired that) — never assume a status
 * value means "lead". There is deliberately no by_source axis: customers carry no
 * `source` column, so it is never invented here.
 *
 * RAPPORTEN-CONSOLIDATIE-1 (2026-08-14): this page carries a Klanten/Prospects switch
 * (ReportSwitchBar, mirrors the Shiftmanager dashboard's "In uren / In diensten"
 * toggle) — new capability, not a merged-away route (there was never a standalone
 * Prospects page). Prospects adds a real SERVER-side `phase` filter on top of the
 * panel filters (never a client-side slice), resolved off the `isCustomer` FLAG
 * (`useCustomerPhases`) — never a hardcoded 'prospect' slug, per this file's own
 * PROSPECT-DEDUP-1 rule above. The default Klanten position is BYTE-IDENTICAL to the
 * pre-existing standalone customers report (no filter added).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BodyText } from '@/components/ui/typography'
import ReportKpiBand from './ReportKpiBand'
import ReportSwitchBar from './ReportSwitchBar'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useCustomersReport } from './useCustomersReport'
import { useReportSwitch } from './useReportSwitch'
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey, CUSTOMERS_SIGNAL_LABEL_KEYS } from './kpiCatalog'
import type { ReportKpiScopeId } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { useNavigation } from '@/context/NavigationContext'
import CustomerDepthSections from './depth/CustomerDepthSections'

// The four plain axes; `param` is the XOR query key the drill/advice endpoints expect.
// Deliberately no 'source' — see the header comment.
type Axis = 'status' | 'phase' | 'industry' | 'branch'

// KPIS-DRILL-1: the nine standing `kpis[]` signal keys that now have their own
// GET /reports/customers/kpi-drill endpoint (measured, api-generated.ts::
// getReportsCustomersKpiDrill) — exactly CUSTOMERS_SIGNAL_LABEL_KEYS's key set.
// A separate GET /reports/customers/kpi-signal-drill endpoint also landed for
// customers_active/customers_prospect/customers_at_risk (getReportsCustomersKpiSignalDrill),
// but this page renders no cards for those three keys, so that endpoint is left
// unwired here — nothing to wire it to.
const CUSTOMERS_KPI_DRILL_KEYS = new Set<string>([
  'contract_ending', 'no_contact', 'task_overdue', 'price_agreement_ending', 'vacancy_stale',
  'departments_without_placement', 'customers_without_vacancies', 'customers_without_applications',
  'matches_stopped_early',
])

// Semantic colour per signal key, applied only when the count is non-zero
// (§4: colour carries meaning — a calm zero stays uncoloured). Mirrors
// CandidatesReport's SUITE_COLOR idiom.
const SIGNAL_COLOR: Partial<Record<string, string>> = {
  contract_ending: 'var(--color-warning)', price_agreement_ending: 'var(--color-warning)',
  vacancy_stale: 'var(--color-warning)', no_contact: 'var(--color-warning)',
  task_overdue: 'var(--color-danger)', matches_stopped_early: 'var(--color-danger)',
  departments_without_placement: 'var(--color-warning)', customers_without_vacancies: 'var(--color-warning)',
  customers_without_applications: 'var(--color-warning)',
}

// The two switch positions — also the KPI-catalog/settings-scope id and the
// i18n namespace-prefix for the population-facing strings. Kept as plain
// `string` on the wire (see CandidatesReport's identical note) so this
// component satisfies ReportsPage's one shared `ReportComponent` contract.
const VIEWS = ['customers', 'prospects'] as const

export default function CustomersReport({ period, filters = EMPTY_REPORT_FILTERS, initialView = 'customers', compare = COMPARE_OFF }: {
  period: ReportPeriod
  filters?: ReportFilterState
  initialView?: string
  compare?: ReportCompareMode
}) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { openEntity } = useNavigation()
  const { phases } = useCustomerPhases()
  const [view, setView] = useReportSwitch(VIEWS, initialView)
  const isProspects = view === 'prospects'

  // Flag-driven, never a hardcoded 'prospect' slug (§3B / PROSPECT-DEDUP-1) —
  // the phase NOT flagged is_customer is the entry/prospect phase.
  const prospectPhaseValue = phases.find(p => p.isDefault && !p.isCustomer)?.value
    ?? phases.find(p => !p.isCustomer)?.value ?? null
  const phaseFilter = isProspects ? prospectPhaseValue : null

  const { data, loading, error, refetch } = useCustomersReport(period, filters, phaseFilter)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('customers', view)
  const compareBaseParams = { ...buildReportQueryParams(period, 'customers', filters), ...(phaseFilter ? { phase: phaseFilter } : {}) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // Drill-down: one shared drawer for the whole page — a segment/bucket click
  // opens it fresh, replacing whatever was open before. Exactly one XOR param
  // per open drill — ALWAYS layered on top of the report's own active filters
  // (`baseParams`), never just `period`, so the drawer counts the exact same set
  // the bar was drawn from. `baseParams` also carries the switch's own `phase` filter.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const baseParams = { ...buildReportQueryParams(period, 'customers', filters), ...(phaseFilter ? { phase: phaseFilter } : {}) }
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      entityPage: 'customers',
      rowsEndpoint: '/reports/customers/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/customers/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/customers/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/customers/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })

  // Chart datum builders — the donut wears each lookup value's OWN colour with
  // the shared series as fallback; rankings get the plain house series
  // (CandidatesReport idiom, §chart-type-rule).
  const donutData = (segs: CandidateSegment[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickSegment = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('customers', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) openSegment(seg, { [axis]: seg.value })
    })
  const barData = (segs: CandidateSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
  const pickBar = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('customers', (d: ChartDatum) => {
      const seg = segs.find(s => s.value === d.key)
      if (seg) openSegment(seg, { [axis]: seg.value })
    })
  const ownerBarData = (segs: CandidateOwnerSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
  const pickOwnerBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('customers', (d: ChartDatum) => {
      const seg = segs.find(s => s.owner_id === d.key)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: seg.owner_id })
    })

  // KPIS-DRILL-1: a signal card whose key is one of the nine kpi-drill enum
  // values opens the same shared drawer, but sourced from the dedicated
  // kpi-drill endpoint (a standing count, not an axis segment — no breakdown).
  // Contract (getReportsCustomersKpiDrill): the endpoint accepts ONLY `kpi` —
  // these are STANDING signals over the live base, so no window params ride
  // along and the subtitle says "live snapshot", never the report window.
  const openSignalKpiDrill = (label: string, count: number, kpi: string) => setDrill({
    title: label, value: count, subtitle: t('customers.signalSnapshot'),
    entityPage: 'customers',
    rowsEndpoint: '/reports/customers/kpi-drill', rowsParams: { kpi },
  })

  const onSeriesPick = gateDrillClick('customers', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Nine-card KPI strip (same footprint as the dashboard): "total" plus eight
  // axis-derived cards, all real counts from the five axes already on the
  // response (§0 no fake affordances — nothing here is invented or hardcoded;
  // deliberately no by_source axis here, see the header comment). Klanten and
  // Prospects keep independently configurable catalogs/orders (`kpiScope`).
  const allAxisConfigs: Record<Axis | 'owner', AxisKpiConfig> = {
    status:   { axis: 'status',   axisLabel: t('customers.axes.status'),   segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    phase:    { axis: 'phase',    axisLabel: t('customers.axes.phase'),    segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    industry: { axis: 'industry', axisLabel: t('customers.axes.industry'), segs: (data?.by_industry ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:    { axis: 'owner',    axisLabel: t('customers.axes.owner'),    segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch:   { axis: 'branch',   axisLabel: t('customers.axes.branch'),   segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }
  // REPORTS-KPI-SPARE-2: the customers-only "signal" pseudo-axes (see kpiCatalog.ts) —
  // each of the report's own STANDING kpis[] counts, wrapped as a single-segment axis
  // config so buildAxisKpis can round-robin it in as one honest card. Never offered on
  // Prospects (kpiCatalog.ts REPORT_KPI_AXIS_CATALOG.prospects has no `signal:*` keys),
  // so `signalAxisConfigs` is simply unused/empty there — no runtime branch needed.
  const signalAxisConfigs: Record<string, AxisKpiConfig> = Object.fromEntries(
    (data?.kpis ?? []).map(k => [`signal:${k.key}`, {
      axis: `signal:${k.key}`,
      axisLabel: t(`customers.kpis.${CUSTOMERS_SIGNAL_LABEL_KEYS[k.key] ?? k.key}`),
      segs: [{ key: 'count', label: '', count: k.count }],
    }]),
  )
  // `view` is constrained to VIEWS at runtime (useReportSwitch); both members
  // are valid KPI-catalog scope ids (kpiCatalog.ts), so the cast is safe.
  const kpiScope = view as ReportKpiScopeId
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog(kpiScope).map(c => c.key)
  const defaultAxisOrder = getReportKpiDefaultOrder(kpiScope)
  const storedAxisOrder = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey(kpiScope), undefined)
  const { order: axisOrder, fellBack } = resolveReportKpiOrder(storedAxisOrder, catalogKeys, defaultAxisOrder)
  const axisConfigs: AxisKpiConfig[] = axisOrder
    .map(axis => allAxisConfigs[axis as Axis | 'owner'] ?? signalAxisConfigs[axis])
    .filter(Boolean)
  // A KPI card for an axis segment opens the page's ONE shared drill drawer on
  // that segment, exactly like clicking the bar itself. A "signal" pseudo-axis
  // whose key is one of the nine kpi-drill enum values now drills via
  // openSignalKpiDrill; a signal key OUTSIDE both enums still has no matching
  // drill (a standing count, not an axis segment) — display-only, same as
  // every other non-clickable KPI card (e.g. departments.customersCount).
  const onAxisKpiPick = gateDrillClick('customers', (axis: string, key: string) => {
    if (axis.startsWith('signal:')) {
      const signalKey = axis.slice('signal:'.length)
      if (!CUSTOMERS_KPI_DRILL_KEYS.has(signalKey)) return
      const cfg = axisConfigs.find(c => c.axis === axis)
      const seg = cfg?.segs.find(s => s.key === key)
      if (seg) openSignalKpiDrill(cfg!.axisLabel, seg.count, signalKey)
      return
    }
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment({ label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpisRaw = buildAxisKpis(axisConfigs, 8,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => {
      const params = drill?.rowsParams as Record<string, unknown> | undefined
      // A signal pseudo-axis drills via `kpi`, a real axis via its own XOR key.
      if (axis.startsWith('signal:')) return params?.kpi === axis.slice('signal:'.length)
      return params?.[axis] === key
    })
  // buildAxisKpis always attaches an onClick; strip it back off for signal cards
  // outside the kpi-drill enum so they render with no clickable affordance (§0
  // no fake affordances) instead of a dead click. A signal card also picks up
  // its semantic colour here, only when the count is non-zero (SIGNAL_COLOR).
  const axisKpis: KpiSpec[] = axisKpisRaw.map(k => {
    const [axisPart] = k.key.split(':')
    if (axisPart !== 'signal') return k
    const signalKey = k.key.slice('signal:'.length).replace(/:count$/, '')
    const withColor = typeof k.value === 'number' && k.value !== 0 ? { ...k, color: SIGNAL_COLOR[signalKey] } : k
    return CUSTOMERS_KPI_DRILL_KEYS.has(signalKey) ? withColor : { ...withColor, onClick: undefined }
  })

  // Card 1's label/window/loading/empty/error text is scoped to the active
  // position — Klanten keeps today's exact wording (a byte-identical default,
  // zero regression), Prospects gets its own.
  const kpis: KpiSpec[] = [
    { key: 'total', label: t(isProspects ? 'prospects.total' : 'customers.total'), value: total,
      sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined },
    ...axisKpis,
  ]

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('customers.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'customers', label: t('customers.viewSwitch.customers') },
          { value: 'prospects', label: t('customers.viewSwitch.prospects') },
        ]} />

      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t(isProspects ? 'prospects.kpiOrderFellBack' : 'customers.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t(isProspects ? 'prospects.window' : 'customers.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t(isProspects ? 'prospects.loading' : 'customers.loading')}
            errorLabel={t(isProspects ? 'prospects.error' : 'customers.error')}
            emptyLabel={t(isProspects ? 'prospects.empty' : 'customers.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Inflow over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t(isProspects ? 'prospects.series' : 'customers.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Coloured lookup axes → donuts (each slice wears its tenant colour). */}
          <ReportChartCard title={t('customers.axes.status')} chart={
            <PieChartCard {...donutData(data.by_status)} onItemClick={pickSegment('status', data.by_status)} />} />

          {/* Leads surface HERE, not on a status value (PROSPECT-DEDUP-1 retired
              the old 'prospect' status) — flag-driven, same principle as the
              dashboard leads KPI. */}
          <ReportChartCard title={t('customers.axes.phase')} chart={
            <PieChartCard {...donutData(data.by_phase)} onItemClick={pickSegment('phase', data.by_phase)} />} />

          {/* Rankings → bar charts. */}
          <ReportChartCard title={t('customers.axes.industry')} chart={
            <BarChartCard data={barData(data.by_industry)} onBarClick={pickBar('industry', data.by_industry)} />} />
          <ReportChartCard title={t('customers.axes.owner')} chart={
            <BarChartCard data={ownerBarData(data.by_owner)} onBarClick={pickOwnerBar(data.by_owner)} />} />

          {/* By-branch card spans the full row: it keeps span=2 even after the
              depth block below it (four halves + one span=2 cohorts card = even). */}
          <ReportChartCard span={2} title={t('customers.axes.branch')} chart={
            <BarChartCard data={barData(data.by_branch)} onBarClick={pickBar('branch', data.by_branch)} />} />

          {/* Depth block (RAPPORT-DIEPTE-1): concentration, churn, per-owner and
              cohort sections. Four halves + the cohorts span-2 card keeps the
              grid parity even after the branch card's own span=2. */}
          <CustomerDepthSections data={data} onOpenCustomer={id => openEntity('customers', id)} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
