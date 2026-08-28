/**
 * CandidatesReport — the candidates/leads report (GET /reports/candidates) and
 * since RAPPORT-GEZICHT-WAVE2 the REFERENCE face for every report page (Danny
 * 24-08, on the reference dashboards): a real nine-KPI strip with semantic
 * colour, a chart MIX instead of uniform segment bars — donuts for the coloured
 * lookup axes (status/phase), bar charts for the rankings (source/owner/branch),
 * the timeseries line full-width — and every click still its own drill into the
 * shared drawer (SM idiom). The compare window moved to the right-hand filter
 * panel (ReportsPage owns it, §4: every filter lives there) and arrives as the
 * `compare` prop.
 *
 * The Kandidaten position reads the REAL suite (GET /reports/candidates/kpis:
 * inflow/outflow + seven attention KPIs, each sharing its predicate with its
 * own drill). The Leads position keeps the axis strip: the suite endpoint's
 * validation does not yet accept the `phase` narrowing Leads needs (asked CMBE,
 * WAVE-1B-CONTRACTVRAGEN-CMBE punt 4) — an unnarrowed suite under a Leads
 * heading would pair all-candidate numbers with leads-only charts.
 */
import { useState, useMemo } from 'react'
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
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import { useCandidatesReport } from './useCandidatesReport'
import { useCandidatesKpiSuite } from './useCandidatesKpiSuite'
import { useReportSwitch } from './useReportSwitch'
import { useLookups } from '@/context/LookupsContext'
import { gateDrillClick } from './reportDrillGate'
import { buildAxisKpis } from './buildAxisKpis'
import type { AxisKpiConfig } from './buildAxisKpis'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import type { ReportKpiScopeId } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'

// The five drillable axes; `param` is the XOR query key the drill/advice endpoints expect.
type Axis = 'status' | 'phase' | 'source' | 'owner' | 'branch'

// The two switch positions — also the KPI-catalog/settings-scope id and the
// i18n namespace-prefix for the population-facing strings. Kept as plain
// `string` on the wire so this component satisfies ReportsPage's shared
// `ReportComponent` contract; useReportSwitch constrains the runtime value.
const VIEWS = ['candidates', 'leads'] as const

// Semantic colour per suite key, applied only when the count is non-zero (§4:
// colour carries meaning — a calm zero stays uncoloured).
const SUITE_COLOR: Partial<Record<string, string>> = {
  no_followup: 'var(--color-danger)', no_contact: 'var(--color-danger)',
  status_stale: 'var(--color-warning)', no_cv: 'var(--color-warning)',
  document_expiring: 'var(--color-warning)', availability_due: 'var(--color-warning)',
  active_conversations: 'var(--color-info)',
}
// Suite key → its i18n label key (candidates.kpi.*; mirrors the fixed catalog).
const SUITE_LABEL_KEY: Record<string, string> = {
  inflow: 'candidates.kpi.inflow', outflow: 'candidates.kpi.outflow',
  no_followup: 'candidates.kpi.noFollowup', status_stale: 'candidates.kpi.statusStale',
  no_cv: 'candidates.kpi.noCv', document_expiring: 'candidates.kpi.documentExpiring',
  availability_due: 'candidates.kpi.availabilityDue', no_contact: 'candidates.kpi.noContact',
  active_conversations: 'candidates.kpi.activeConversations',
}

// Candidates/leads report and the house reference face for reports: real KPI suite for Candidates, the older axis strip for Leads until its endpoint accepts a phase narrowing (see file header).
export default function CandidatesReport({ period, filters = EMPTY_REPORT_FILTERS, initialView = 'candidates', compare = COMPARE_OFF }: {
  period: ReportPeriod
  filters?: ReportFilterState
  initialView?: string
  compare?: ReportCompareMode
}) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { phases } = useLookups()
  const [view, setView] = useReportSwitch(VIEWS, initialView)
  const isLeads = view === 'leads'

  // Flag-driven, never a hardcoded slug (§3B) — mirrors the backend's own
  // "which phase counts as a lead" resolution exactly.
  const leadPhaseValue = phases.find(p => p.is_default && !p.is_applicant)?.value
    ?? phases.find(p => !p.is_applicant)?.value ?? null
  const phaseFilter = isLeads ? leadPhaseValue : null

  const { data, loading, error, refetch } = useCandidatesReport(period, filters, phaseFilter)
  // The real KPI suite — only fetched on the Kandidaten position (see file-top).
  const suite = useCandidatesKpiSuite(period, filters, !isLeads)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-2: the compare mode arrives from the right-hand filter
  // panel (ReportsPage). Same window + same filters as the plain report call.
  const compareSlug = getCompareSlug('candidates', view)
  const compareBaseParams = { ...buildReportQueryParams(period, 'candidates', filters), ...(phaseFilter ? { phase: [phaseFilter] } : {}) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // Drill-down: one shared drawer for the whole page. Exactly one XOR param per
  // open drill, always layered on the report's own active filters, and every
  // candidates drill deep-links its rows to the candidate drilldown (entityPage,
  // SM idiom: name in-app, icon in a new tab).
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const baseParams = { ...buildReportQueryParams(period, 'candidates', filters), ...(phaseFilter ? { phase: [phaseFilter] } : {}) }
  const openSegment = (_axis: Axis, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      entityPage: 'candidates',
      rowsEndpoint: '/reports/candidates/drill', rowsParams: { ...baseParams, ...xorParam },
      adviceEndpoint: '/reports/candidates/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    entityPage: 'candidates',
    // A week bar's `date` is the point's own key; the drawer then counts the
    // WHOLE week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/candidates/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/candidates/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })
  // A suite card drills its OWN key — the drill shares the card's predicate
  // (CandidatesReport::kpiSegmentQuery), so number and drawer always agree.
  const openSuiteDrill = (kpi: string, label: string, value: string | number) =>
    gateDrillClick('candidates', () => setDrill({
      title: label, value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
      entityPage: 'candidates',
      rowsEndpoint: '/reports/candidates/kpis/drill',
      rowsParams: { ...buildReportQueryParams(period, 'candidates', filters), kpi },
    }))

  // Chart datum builders — the donut wears each lookup value's OWN colour with
  // the shared series as fallback; rankings get the plain house series.
  const donutData = (segs: CandidateSegment[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  const pickSegment = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('candidates', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) openSegment(axis, seg, { [axis]: seg.value })
    })
  const barData = (segs: CandidateSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
  const ownerBarData = (segs: CandidateOwnerSegment[]): ChartDatum[] =>
    segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
  const pickBar = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('candidates', (d: ChartDatum) => {
      const seg = segs.find(s => s.value === d.key)
      if (seg) openSegment(axis, seg, { [axis]: seg.value })
    })
  const pickOwnerBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('candidates', (d: ChartDatum) => {
      const seg = segs.find(s => s.owner_id === d.key)
      if (seg) openSegment('owner', { label: seg.name, count: seg.count }, { owner: seg.owner_id })
    })

  const onSeriesPick = gateDrillClick('candidates', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Leads position: the axis strip (see file-top for why the suite can't narrow
  // to leads yet) — total + eight axis cards, exactly the pre-wave-2 machinery.
  // Only consumed on the Leads position (isLeads branch below) — memoized so it
  // isn't rebuilt on the Kandidaten position where it's never read.
  const allAxisConfigs: Record<string, AxisKpiConfig> = useMemo(() => ({
    status: { axis: 'status', axisLabel: t('candidates.axes.status'), segs: (data?.by_status ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    phase:  { axis: 'phase',  axisLabel: t('candidates.axes.phase'),  segs: (data?.by_phase ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    source: { axis: 'source', axisLabel: t('candidates.axes.source'), segs: (data?.by_source ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner:  { axis: 'owner',  axisLabel: t('candidates.axes.owner'),  segs: (data?.by_owner ?? []).map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch: { axis: 'branch', axisLabel: t('candidates.axes.branch'), segs: (data?.by_branch ?? []).map(s => ({ key: s.value, label: s.label, count: s.count })) },
    owner_none:  { axis: 'owner',  axisLabel: t('candidates.axes.owner'),  segs: (data?.by_owner ?? []).filter(s => s.owner_id === 'none').map(s => ({ key: s.owner_id, label: s.name, count: s.count })) },
    branch_none: { axis: 'branch', axisLabel: t('candidates.axes.branch'), segs: (data?.by_branch ?? []).filter(s => s.value === 'none').map(s => ({ key: s.value, label: s.label, count: s.count })) },
    source_none: { axis: 'source', axisLabel: t('candidates.axes.source'), segs: (data?.by_source ?? []).filter(s => s.value === 'none').map(s => ({ key: s.value, label: s.label, count: s.count })) },
  }), [data, t])
  const kpiScope = view as ReportKpiScopeId
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog(kpiScope).map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder(kpiScope)
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey(kpiScope), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)

  const openKpiParams = drill?.rowsParams as Record<string, unknown> | undefined
  let kpis: KpiSpec[]
  if (isLeads) {
    const axisConfigs: AxisKpiConfig[] = kpiOrder.map(axis => allAxisConfigs[axis]).filter(Boolean)
    const onAxisKpiPick = gateDrillClick('candidates', (axis: string, key: string) => {
      const cfg = axisConfigs.find(c => c.axis === axis)
      const seg = cfg?.segs.find(s => s.key === key)
      if (seg) openSegment(axis as Axis, { label: seg.label, count: seg.count }, { [axis]: key })
    })
    const axisKpis = buildAxisKpis(axisConfigs, 8,
      (axis, key) => onAxisKpiPick?.(axis, key),
      (axis, key) => openKpiParams?.[axis] === key)
    kpis = [
      { key: 'total', label: t('leads.total'), value: total,
        sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined },
      ...axisKpis,
    ]
  } else {
    // Kandidaten position: the real suite, in the tenant's stored order. A key
    // the server omitted renders the house dash with no drill (STATS-HONEST-1).
    kpis = kpiOrder.flatMap((key): KpiSpec[] => {
      const labelKey = SUITE_LABEL_KEY[key]
      if (!labelKey) return []
      const label = t(labelKey)
      const raw = suite.get(key)
      const has = raw != null
      return [{
        key, label, value: has ? raw : '—',
        color: has && raw !== 0 ? SUITE_COLOR[key] : undefined,
        active: openKpiParams?.kpi === key,
        onClick: has ? openSuiteDrill(key, label, raw) : undefined,
      }]
    })
  }

  return (
    <div>
      <ReportSwitchBar ariaLabel={t('candidates.viewSwitch.ariaLabel')} value={view} onChange={setView}
        options={[
          { value: 'candidates', label: t('candidates.viewSwitch.candidates') },
          { value: 'leads', label: t('candidates.viewSwitch.leads') },
        ]} />

      {/* KPI strip — the real suite (Kandidaten) / axis cards (Leads) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t(isLeads ? 'leads.kpiOrderFellBack' : 'candidates.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, DD-MM-YYYY (§3B DATUM-1), with the compare
          delta beside it — the comparison explains the page TOTAL, so it lives
          on the total's own line, never mixed into a differently-defined card. */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {t(isLeads ? 'leads.window' : 'candidates.window', { from: formatDate(data.from), to: formatDate(data.to) })}
          {!isLeads && totalCompare && <ReportCompareMetric metric={totalCompare} polarity="up-good" />}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t(isLeads ? 'leads.loading' : 'candidates.loading')}
            errorLabel={t(isLeads ? 'leads.error' : 'candidates.error')}
            emptyLabel={t(isLeads ? 'leads.empty' : 'candidates.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Inflow over time — the line, full width. */}
          <ReportChartCard span={2} title={t(isLeads ? 'leads.series' : 'candidates.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Coloured lookup axes → donuts (each slice wears its tenant colour). */}
          <ReportChartCard title={t('candidates.axes.status')} chart={
            <PieChartCard {...donutData(data.by_status)} onItemClick={pickSegment('status', data.by_status)} />} />
          <ReportChartCard title={t('candidates.axes.phase')} chart={
            <PieChartCard {...donutData(data.by_phase)} onItemClick={pickSegment('phase', data.by_phase)} />} />

          {/* Rankings → bar charts. */}
          <ReportChartCard title={t('candidates.axes.source')} chart={
            <BarChartCard data={barData(data.by_source)} onBarClick={pickBar('source', data.by_source)} />} />
          <ReportChartCard title={t('candidates.axes.owner')} chart={
            <BarChartCard data={ownerBarData(data.by_owner)} onBarClick={pickOwnerBar(data.by_owner)} />} />

          {/* Last odd card spans the full row — no empty grid hole (uitlijning). */}
          <ReportChartCard span={2} title={t('candidates.axes.branch')} chart={
            <BarChartCard data={barData(data.by_branch)} onBarClick={pickBar('branch', data.by_branch)} />} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page — opens only on click. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
