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
import { renderKpiValue } from './renderKpiValue'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BodyText } from '@/components/ui/typography'
import ReportKpiBand from './ReportKpiBand'
import ReportSwitchBar from './ReportSwitchBar'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import { PieAxisCard } from './lib/PieAxisCard'
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
import BarChartCard from '@/components/charts/BarChartCard'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useReportKpiOrdering } from './hooks/useReportKpiOrdering'
import { orderKpis } from './lib/kpiOrder'
import { reportWindowLabel } from './lib/reportWindowLabel'
import { CUSTOMERS_SIGNAL_LABEL_KEYS, type ReportKpiScopeId } from './kpiCatalog'
import { useReportCompareData } from './hooks/useReportCompareData'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { ReportStateFlow } from './components/ReportStateFlow'
import { ReportCompareStatus } from './components/ReportCompareStatus'
import { useNavigation } from '@/context/NavigationContext'
import CustomerDepthSections from './depth/CustomerDepthSections'
import { barData, ownerBarData } from './lib/chartData'
import { makeOpenSegment } from './lib/drillFactories'
import { segmentClick, ownerClick } from './lib/drillClick'
import { useReportCustomKpis } from './hooks/useReportCustomKpis'

// The four plain axes; `param` is the XOR query key the drill/advice endpoints expect.
// Deliberately no 'source' — see the header comment.
type Axis = 'status' | 'phase' | 'industry' | 'branch'

// KPI-CUSTOMERS-SIGNALS-1: the nine CUSTOMERS_SIGNAL_LABEL_KEYS are the Klanten position's
// fixed strip and drill via GET /reports/customers/kpis/drill (nine KD10 keys only). The three
// Prospects server cards drill via GET /reports/customers/signals/drill, which takes the window
// params but no phase_filter. REPORT-INTAKES-FILTERS-1 (BE 6fdf12208) named these two canonical
// paths; the old kpi-drill / kpi-signal-drill aliases stay until the BE retire row that follows this landing.
// Server prospect card key -> its label key; an unknown server key is skipped, never shown in server English.
const PROSPECT_KPI_LABEL_KEYS: Record<string, string> = {
  customers_prospect: 'prospects.total',
  prospects_no_contact: 'customers.kpis.prospectsNoContact', prospects_task_overdue: 'customers.kpis.prospectsTaskOverdue',
}

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
  // A standing prospect signal (no recent contact, overdue tasks, a branch count) is a snapshot,
  // not a windowed count: the strip must show it even in a month without new prospects (12-11).
  const pkSignal = !!data?.prospect_kpis && (data.prospect_kpis.cards.some(c => (c.count ?? 0) > 0) || data.prospect_kpis.by_branch.some(b => (b.count ?? 0) > 0))
  const showBand = hasData || (!loading && !error && isProspects && pkSignal)

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const { totalCompare, loading: compareLoading, error: compareError, refetch: refetchCompare } = useReportCompareData(period, 'customers', filters, data, compare, phaseFilter ? { phase: [phaseFilter] } : undefined, view)

  // Drill-down: one shared drawer for the whole page — a segment/bucket click
  // opens it fresh, replacing whatever was open before. Exactly one XOR param
  // per open drill — ALWAYS layered on top of the report's own active filters
  // (`baseParams`), never just `period`, so the drawer counts the exact same set
  // the bar was drawn from. `baseParams` also carries the switch's own `phase` filter.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => reportWindowLabel(formatDate, data?.from, data?.to)
  // Drill/advice population filter rides as phase_filter[] (CMBE a0d4627e) —
  // the XOR segment key `phase` stays free for the segment picker; the compare
  // params above keep `phase` (the report endpoint's own array contract).
  const baseParams = { ...buildReportQueryParams(period, 'customers', filters), ...(phaseFilter ? { phase_filter: [phaseFilter] } : {}) }
  const openSegment = makeOpenSegment({ entityPage: 'customers', rowsEndpoint: '/reports/customers/drill', adviceEndpoint: '/reports/customers/advice', baseParams, windowSub, setDrill })

  // KPI-BUILDER-FE-1: the definition drill route (§0.2) accepts only the panel-
  // filter vocabulary — never `phase_filter` (a switch-bar param this report
  // invents, not a documented drill/advice param) — the shared hook strips it.
  const { customKpis, extraTitle: customKpiTitle } = useReportCustomKpis({
    data, drill, baseParams, windowSub, setDrill, entityPage: 'customers',
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
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
  const pickSegment = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('customers', segmentClick(segs, axis, openSegment))
  const pickBar = (axis: Axis, segs: CandidateSegment[]) =>
    gateDrillClick('customers', segmentClick(segs, axis, openSegment))
  const pickOwnerBar = (segs: CandidateOwnerSegment[]) =>
    gateDrillClick('customers', ownerClick(segs, openSegment))

  // KPIS-DRILL-1: a signal card whose key is one of the nine kpis/drill enum
  // values opens the same shared drawer, but sourced from the dedicated
  // kpis/drill endpoint (a standing count, not an axis segment — no breakdown).
  // Contract (getReportsCustomersKpiDrill): the endpoint accepts ONLY `kpi` —
  // these are STANDING signals over the live base, so no window params ride
  // along and the subtitle says "live snapshot", never the report window.
  const openSignalKpiDrill = (label: string, count: number, kpi: string) => setDrill({
    title: label, value: count, subtitle: t('customers.signalSnapshot'),
    entityPage: 'customers',
    rowsEndpoint: '/reports/customers/kpis/drill', rowsParams: { kpi },
  })

  // Prospect server cards drill via signals/drill: window + panel filters + kpi, no phase_filter.
  const openProspectKpiDrill = (label: string, count: number, kpi: string) => setDrill({
    title: label, value: count,
    subtitle: kpi === 'customers_prospect' ? windowSub() : t('customers.signalSnapshot'),
    entityPage: 'customers',
    rowsEndpoint: '/reports/customers/signals/drill',
    rowsParams: { ...buildReportQueryParams(period, 'customers', filters), kpi },
  })

  const onSeriesPick = gateDrillClick('customers', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Klanten and Prospects keep independently configurable catalogs/orders
  // (`kpiScope`) — Klanten's cards 2-9 are the fixed signal suite below,
  // Prospects reads prospect_kpis (server cards) with the axis fill behind it.
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
  const { kpiOrder, fellBack } = useReportKpiOrdering(kpiScope)

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
        key, label, value: renderKpiValue(raw, has, undefined),
        // STANDING signal, not a windowed count — every card says so (§SCHERMWAARHEID).
        sub: t('customers.signalSnapshot'),
        color: has && raw !== 0 ? SIGNAL_COLOR[key] : undefined,
        active: (drill?.rowsParams as Record<string, unknown> | undefined)?.kpi === key,
        onClick: has ? gateDrillClick('customers', () => openSignalKpiDrill(label, raw as number, key)) : undefined,
      } satisfies KpiSpec]
    }),
  )
  // orderKpis is the shared projection; the ordering hook stays a direct call
  // because the Prospects strip below consumes the same order a second time.
  const signalKpis: KpiSpec[] = orderKpis(kpiOrder, signalKpiByKey)

  // Prospects fallback strip (and fill): buildAxisKpis round-robins the
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
  // window line below the strip). Prospects reads the server prospect_kpis when present (axis fill tops up to nine), else total + eight axis cards.
  const pk = data?.prospect_kpis
  // SERVER-KPIS-1: the three server prospect cards (dash when missing) + branch cards + axis fill, up to nine (buildAxisKpis fills only while the axes allow).
  // The stored KPI order applies to the fill only; branch axes are dropped there (the server branch cards own them).
  const prospectOpen = drill?.rowsParams as Record<string, unknown> | undefined
  let serverProspectKpis: KpiSpec[] = []
  if (pk) {
    const serverCounts = new Map(pk.cards.map(c => [c.key, c.count]))
    const cards = Object.entries(PROSPECT_KPI_LABEL_KEYS).map(([key, labelKey]): KpiSpec => {
      const label = t(labelKey)
      const raw = serverCounts.get(key)
      const has = raw != null
      return {
        key, label, value: renderKpiValue(raw, has, undefined),
        // Compare belongs on the windowed prospect total (same population as the compare call).
        sub: key === 'customers_prospect'
          ? (totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined)
          : t('customers.signalSnapshot'),
        active: prospectOpen?.kpi === key,
        onClick: has ? gateDrillClick('customers', () => openProspectKpiDrill(label, raw as number, key)) : undefined,
      }
    })
    // A zero-count bucket (the BE's `none` bucket at 0, an empty branch) says nothing and would push a
    // real branch off the nine-card strip (screen probe 13-11: 'Geen vestiging 0' as the ninth card).
    const branches = pk.by_branch.filter(b => b.count > 0).slice(0, Math.max(0, 9 - cards.length)).map((b): KpiSpec => ({
      key: `branch:${b.value}`, label: b.label, value: b.count,
      active: prospectOpen?.branch === b.value,
      onClick: gateDrillClick('customers', () => openSegment({ label: b.label, count: b.count }, { branch: b.value })),
    }))
    const fill = buildAxisKpis(axisConfigs.filter(c => c.axis !== 'branch'), Math.max(0, 9 - cards.length - branches.length),
      (axis, key) => onAxisKpiPick?.(axis, key),
      (axis, key) => prospectOpen?.[axis] === key)
    serverProspectKpis = [...cards, ...branches, ...fill]
  }
  const kpis: KpiSpec[] = isProspects && pk
    ? serverProspectKpis
    : isProspects
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

      {/* KPI strip — total inflow, above the tabs (candidate-page order); on Prospects also for a standing signal alone */}
      {showBand && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t(isProspects ? 'prospects.kpiOrderFellBack' : 'customers.kpiOrderFellBack') : undefined}
          extraKpis={customKpis} extraTitle={customKpiTitle} />
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

      {/* An explicitly requested comparison never fails silently (§3A four states). */}
      {!loading && !error && data && (
        <ReportCompareStatus compare={compare} loading={compareLoading} error={compareError} onRetry={refetchCompare} />
      )}

      <ReportStateFlow
        loading={loading}
        error={error}
        empty={!loading && !error && total === 0}
        loadingLabel={t(isProspects ? 'prospects.loading' : 'customers.loading')}
        errorLabel={t(isProspects ? 'prospects.error' : 'customers.error')}
        emptyLabel={t(isProspects ? 'prospects.empty' : 'customers.empty')}
        onRetry={() => refetch()}
      />

      {hasData && data && (
        <ReportGrid>
          {/* Inflow over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t(isProspects ? 'prospects.series' : 'customers.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} bucket={data.timeseries.bucket} onPick={onSeriesPick} />} />

          {/* Coloured lookup axes → donuts (each slice wears its tenant colour). */}
          <PieAxisCard title={t('customers.axes.status')} segments={data.by_status} onItemClick={pickSegment('status', data.by_status)} />

          {/* Leads surface HERE, not on a status value (PROSPECT-DEDUP-1 retired
              the old 'prospect' status) — flag-driven, same principle as the
              dashboard leads KPI. */}
          <PieAxisCard title={t('customers.axes.phase')} segments={data.by_phase} onItemClick={pickSegment('phase', data.by_phase)} />

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
