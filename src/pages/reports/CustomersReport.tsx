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

// KPI-CUSTOMERS-SIGNALS-1: CUSTOMERS_SIGNAL_LABEL_KEYS's nine keys are now the
// Klanten position's ENTIRE fixed KPI-strip catalog (kpiCatalog.ts,
// REPORT_KPI_FAMILY.customers = 'fixed') — every one of them has its own
// GET /reports/customers/kpi-drill endpoint (measured, api-generated.ts::
// getReportsCustomersKpiDrill), so all nine are drillable, no separate
// "which of these nine" set needed any more. A separate GET
// /reports/customers/kpi-signal-drill endpoint also landed for
// customers_active/customers_prospect/customers_at_risk (getReportsCustomersKpiSignalDrill),
// but this page renders no cards for those three keys, so that endpoint stays unwired here.

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

// The customers inflow report, with its Klanten/Prospects switch.
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

  // Klanten and Prospects keep independently configurable catalogs/orders
  // (`kpiScope`) — Klanten's cards 2-9 are the fixed signal suite below,
  // Prospects' stay the axis-topsegment strip (unaffected by the conversion).
  const allAxisConfigs: Record<Axis | 'owner', AxisKpiConfig> = {
    status:   { axis: 'status',   axisLabel: t('customers.axes.status'),   segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    phase:    { axis: 'phase',    axisLabel: t('customers.axes.phase'),    segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    industry: { axis: 'industry', axisLabel: t('customers.axes.industry'), segs: (data?.by_industry ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:    { axis: 'owner',    axisLabel: t('customers.axes.owner'),    segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch:   { axis: 'branch',   axisLabel: t('customers.axes.branch'),   segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }
  // `view` is constrained to VIEWS at runtime (useReportSwitch); both members
  // are valid KPI-catalog scope ids (kpiCatalog.ts), so the cast is safe.
  const kpiScope = view as ReportKpiScopeId
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog(kpiScope).map(c => c.key)
  const defaultKpiOrder = getReportKpiDefaultOrder(kpiScope)
  const storedKpiOrder = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey(kpiScope), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(storedKpiOrder, catalogKeys, defaultKpiOrder)

  // KPI-CUSTOMERS-SIGNALS-1 (mirrors TasksReport/OutreachReport's
  // kpiByServerKey idiom): the Klanten position's cards 2-9 are the server's
  // own nine STANDING signal kpis[] cards, read verbatim — value and drawer
  // rows share ONE backend predicate per key, so they can never diverge. A key
  // the server omitted renders the house dash with no drill — never a value
  // from another population.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const signalKpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(CUSTOMERS_SIGNAL_LABEL_KEYS).map(([key, i18nSuffix]) => {
      const label = t(`customers.kpis.${i18nSuffix}`)
      const raw = kpiByServerKey.get(key)
      const has = raw != null
      return [key, {
        key, label, value: has ? raw : '—',
        // STANDING signal, not a windowed count — every card says so (§SCHERMWAARHEID).
        sub: t('customers.signalSnapshot'),
        color: has && raw !== 0 ? SIGNAL_COLOR[key] : undefined,
        active: (drill?.rowsParams as Record<string, unknown> | undefined)?.kpi === key,
        onClick: has ? gateDrillClick('customers', () => openSignalKpiDrill(label, raw as number, key)) : undefined,
      } satisfies KpiSpec]
    }),
  )
  const signalKpis: KpiSpec[] = kpiOrder.map(key => signalKpiByKey[key]).filter((k): k is KpiSpec => k != null)

  // Prospects keeps the axis-topsegment strip: buildAxisKpis round-robins the
  // five configured axes' top segments in, a KPI-card click opening the SAME
  // shared drawer as clicking the underlying bar/donut segment.
  const axisConfigs: AxisKpiConfig[] = isProspects
    ? kpiOrder.map(axis => allAxisConfigs[axis as Axis | 'owner']).filter((c): c is AxisKpiConfig => c != null)
    : []
  const onAxisKpiPick = gateDrillClick('customers', (axis: string, key: string) => {
    const cfg = axisConfigs.find(c => c.axis === axis)
    const seg = cfg?.segs.find(s => s.key === key)
    if (seg) openSegment({ label: seg.label, count: seg.count }, { [axis]: key })
  })
  const axisKpis: KpiSpec[] = buildAxisKpis(axisConfigs, 8,
    (axis, key) => onAxisKpiPick?.(axis, key),
    (axis, key) => (drill?.rowsParams as Record<string, unknown> | undefined)?.[axis] === key)

  // ReportKpiBand renders EXACTLY nine cards, never ten (house invariant). Klanten's
  // nine ARE the fixed signal suite (KPI-CUSTOMERS-SIGNALS-1) — no separate pinned
  // "total" card any more, mirroring outreach/tasks (their own total lives inside
  // their nine-key suite; the windowed inflow total + compare moved INTO the
  // window line below the strip). Prospects is untouched: total + eight axis cards.
  const kpis: KpiSpec[] = isProspects
    ? [
        { key: 'total', label: t('prospects.total'), value: total,
          sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined },
        ...axisKpis,
      ]
    : signalKpis
  // Klanten's windowed inflow TOTAL (and its compare metric) lost their card in
  // the signal-suite flip — the window line below carries them instead, so the
  // number and the vergelijk-met stay visible (nine-card invariant holds).

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
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isProspects
            ? t('prospects.window', { from: formatDate(data.from), to: formatDate(data.to) })
            : t('customers.windowWithTotal', { from: formatDate(data.from), to: formatDate(data.to), total })}
          {!isProspects && totalCompare && <ReportCompareMetric metric={totalCompare} polarity="up-good" />}
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
