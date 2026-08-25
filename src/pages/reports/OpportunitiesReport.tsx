/**
 * OpportunitiesReport — opportunities (kansen) pipeline report (GET
 * /reports/opportunities, RAPPORTEN-SUITE-1 "portie 5"). Mirrors CustomersReport /
 * VacanciesReport 1:1: same envelope family, same calm hand-rolled bars via the
 * shared SegmentBars, the window rendered prominently. Drill XOR params follow the
 * five-way opportunities contract: stage|customer|owner|branch|date (+bucket=week
 * next to a week bar's date). Every axis sums to `total`; 'none'/'others' sentinels
 * and orphan-uuid rows (deleted stage / hard-deleted customer) are normal, drillable
 * bars. Forecast/stale from the envelope are deliberately not rendered yet (own
 * design round) — nothing hidden is interactive, so no fake affordances.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import ReportDrillDrawer from './ReportDrillDrawer'
import { BodyText } from '@/components/ui/typography'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOpportunitiesReport } from './useOpportunitiesReport'
import { gateDrillClick } from './reportDrillGate'
import PieChartCard from '@/components/charts/PieChartCard'
import BarChartCard from '@/components/charts/BarChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat, formatPercent } from '@/lib/formatters'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'

// The kpis/drill `kpi` enum, measured in api-generated.ts::getReportsOpportunitiesKpisDrill
// (line 45105): "total" | "open" | "won" | "lost" | "win_rate" | "open_value" |
// "stale" | "closing_soon" | "untouched" | "overdue" | "forecast_count" | "forecast_value".
type OpportunitiesKpiKey =
  | 'total' | 'open' | 'won' | 'lost' | 'win_rate' | 'open_value'
  | 'stale' | 'closing_soon' | 'untouched' | 'overdue' | 'forecast_count' | 'forecast_value'

// The three plain single-value XOR axes; `owner` has its own D2 shape below.
type Axis = 'stage' | 'customer' | 'branch'

// Minimal surface the generic bar renderer needs — stage rows carry a lookup
// colour, customer/branch rows do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

// Semantic colour per signal card, non-zero only (§4) — one map, mirroring the
// reference's SUITE_COLOR idiom (wave-2 Opus minor: no per-card ternary paint).
const OPP_COLOR: Record<string, string> = {
  won: 'var(--color-success)', lost: 'var(--color-danger)',
  untouched: 'var(--color-warning)', overdue: 'var(--color-danger)',
  staleDeal: 'var(--color-warning)', closingSoon: 'var(--color-warning)',
}

export default function OpportunitiesReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatCurrency } = useNumberFormat()
  const { data, loading, error, refetch } = useOpportunitiesReport(period, filters)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('opportunities')
  const { data: compareData } = useReportCompare(compareSlug, data?.period.from, data?.period.to, compare, { period })
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // Drill-down: one shared drawer for the whole page — a segment/bucket click
  // opens it fresh, replacing whatever was open before. Exactly one XOR param
  // per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.period.from)} – ${formatDate(data?.period.to)}`
  // Every drill (axis segment, bucket, KPI card) layers on top of the report's own
  // active panel filters (status/owner/branch/customer + value_min/value_max),
  // never just `period` — mirrors VacanciesReport's baseParams so bar and drawer
  // total always agree on the same underlying set. buildReportQueryParams already
  // attaches value_min/value_max for 'opportunities' (reportFilterParams.ts).
  const baseParams = buildReportQueryParams(period, 'opportunities', filters)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      entityPage: 'opportunities',
      rowsEndpoint: '/reports/opportunities/drill', rowsParams: { ...baseParams, ...xorParam },
      // K-192: advice now validates the panel filters exactly like the drill (see
      // getReportsOpportunitiesAdvice, api-generated.ts:46593 — owner_id/location_id/
      // status/customer_id/value_min/value_max all listed) — so advice and drawer
      // rows share one population. baseParams already carries period.
      adviceEndpoint: '/reports/opportunities/advice', adviceParams: { ...baseParams, ...xorParam },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/opportunities/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/opportunities/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })
  // WAVE-1B: per-KPI-card drill via GET /reports/opportunities/kpis/drill?kpi=<key>
  // (measured in api-generated.ts::getReportsOpportunitiesKpisDrill) layered on the
  // same baseParams every other drill uses; rows are opportunities.
  const openKpiDrill = (label: string, value: number | string, kpi: OpportunitiesKpiKey) => setDrill({
    title: label, value, subtitle: windowSub(),
    entityPage: 'opportunities',
    rowsEndpoint: '/reports/opportunities/kpis/drill', rowsParams: { ...baseParams, kpi },
  })

  // Stage axis: a lookup axis with its own colour per value (CHART-TYPE RULE) →
  // donut. 'none'/'others' sentinels and orphaned (deleted-lookup) values are
  // all normal array entries — each slice drills on its RAW value.
  const stageDonut = (segs: AxisSeg[]) => {
    const donutData = {
      data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
      colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
    }
    const onPick = gateDrillClick('opportunities', (d: unknown) => {
      const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
      const seg = segs.find(s => s.value === key)
      if (seg) openSegment(seg, { stage: key })
    })
    return <PieChartCard {...donutData} onItemClick={onPick} />
  }

  // Ranking axes (customer/branch: people/orgs, no lookup colour) → bar chart.
  const bars = (axis: Exclude<Axis, 'stage'>, segs: AxisSeg[]) => {
    const data: ChartDatum[] = segs.map(s => ({ name: s.label, value: s.count, key: s.value }))
    const onPick = gateDrillClick('opportunities', (d: ChartDatum) => {
      const seg = segs.find(s => s.value === d.key)
      if (seg) openSegment(seg, { [axis]: d.key })
    })
    return <BarChartCard data={data} onBarClick={onPick} />
  }

  // Owner axis (D2 shape: owner_id/name → the `owner` param) → bar chart.
  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const data: ChartDatum[] = segs.map(s => ({ name: s.name, value: s.count, key: s.owner_id }))
    const onPick = gateDrillClick('opportunities', (d: ChartDatum) => {
      const seg = segs.find(s => s.owner_id === d.key)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: d.key })
    })
    return <BarChartCard data={data} onBarClick={onPick} />
  }

  const onSeriesPick = gateDrillClick('opportunities', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Pipeline-health KPI strip from the envelope's totals. WAVE-1B: every card
  // whose key maps 1:1 onto a kpis/drill enum value (measured line 45105) now
  // opens the shared drawer via openKpiDrill; win_rate is null until a deal is
  // decided — placeholder, never a fabricated 0%. Nine-card footprint (Danny —
  // same as the dashboard).
  const s = data?.totals
  const forecastCount = data?.forecast.reduce((sum, row) => sum + row.count, 0) ?? 0
  const forecastValue = data?.forecast.reduce((sum, row) => sum + row.value_sum, 0) ?? 0
  // Spare-card sources (REPORTS-KPI-SPARE-1): the top real segment of by_stage /
  // by_customer (excluding 'none'/'others' sentinels, same rule VacanciesReport
  // uses for topIndustry/topOwner) — clicking reuses the page's own openSegment,
  // exactly like the bars() drill and the default-on-mount effect above.
  const topReal = <T extends { value: string; count: number; label: string }>(segs: T[]) =>
    segs.filter(x => x.value !== 'none' && x.value !== 'others').sort((a, b) => b.count - a.count)[0]
  const topStage = topReal(data?.by_stage ?? [])
  const topCustomer = topReal(data?.by_customer ?? [])
  const kpiByKey: Record<string, KpiSpec> = {
    total:   { key: 'total',   label: t('opportunities.total'),           value: total,
      sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.total'), total, 'total')) },
    open:    { key: 'open',    label: t('opportunities.summary.open'),    value: s?.open ?? 0,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.open'), s?.open ?? 0, 'open')) },
    won:     { key: 'won',     label: t('opportunities.summary.won'),     value: s?.won ?? 0,
      color: s?.won ? OPP_COLOR.won : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.won'), s?.won ?? 0, 'won')) },
    lost:    { key: 'lost',    label: t('opportunities.summary.lost'),    value: s?.lost ?? 0,
      color: s?.lost ? OPP_COLOR.lost : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.lost'), s?.lost ?? 0, 'lost')) },
    winRate: { key: 'winRate', label: t('opportunities.summary.winRate'),
      value: formatPercent(s?.win_rate),
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.winRate'), formatPercent(s?.win_rate), 'win_rate')) },
    untouched: { key: 'untouched', label: t('opportunities.stale.untouched'), value: data?.stale.untouched ?? 0,
      color: data?.stale.untouched ? OPP_COLOR.untouched : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.stale.untouched'), data?.stale.untouched ?? 0, 'untouched')) },
    overdue:   { key: 'overdue',   label: t('opportunities.stale.overdue'),   value: data?.stale.overdue ?? 0,
      color: data?.stale.overdue ? OPP_COLOR.overdue : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.stale.overdue'), data?.stale.overdue ?? 0, 'overdue')) },
    forecastCount: { key: 'forecastCount', label: t('opportunities.forecastCount'), value: forecastCount,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.forecastCount'), forecastCount, 'forecast_count')) },
    forecastValue: { key: 'forecastValue', label: t('opportunities.forecastValue'), value: formatCurrency(forecastValue, 'EUR', 0),
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.forecastValue'), formatCurrency(forecastValue, 'EUR', 0), 'forecast_value')) },
    // Spares: real money fields already in `totals` (money via formatCurrency,
    // never a raw number) + the two top-segment picks above. openValue maps 1:1
    // onto the kpis/drill enum's `open_value`; wonValue has no matching enum
    // value (measured — the enum stops at open_value) so it stays a plain,
    // honest, non-clickable stat (no fake affordances).
    openValue: { key: 'openValue', label: t('opportunities.summary.openValue'), value: formatCurrency(s?.open_value ?? 0, 'EUR', 0),
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.openValue'), formatCurrency(s?.open_value ?? 0, 'EUR', 0), 'open_value')) },
    wonValue:  { key: 'wonValue',  label: t('opportunities.summary.wonValue'),  value: formatCurrency(s?.won_value ?? 0, 'EUR', 0) },
    topStage: { key: 'topStage', label: t('opportunities.summary.topStage'),
      value: topStage ? `${topStage.label} · ${topStage.count}` : '—',
      onClick: topStage ? gateDrillClick('opportunities', () => openSegment(topStage, { stage: topStage.value })) : undefined },
    topCustomer: { key: 'topCustomer', label: t('opportunities.summary.topCustomer'),
      value: topCustomer ? `${topCustomer.label} · ${topCustomer.count}` : '—',
      onClick: topCustomer ? gateDrillClick('opportunities', () => openSegment(topCustomer, { customer: topCustomer.value })) : undefined },
    // KPI-DREMPELS-FE-1: totals.stale / totals.closing_soon (additive, distinct from
    // the older top-level `stale` object above — a different, updated_at-based
    // contract left untouched), each with its own tenant day-threshold caption.
    // WAVE-1B: both now map 1:1 onto the kpis/drill enum (stale/closing_soon) and
    // drill via openKpiDrill, same as every other mapped card above.
    staleDeal: { key: 'staleDeal', label: t('opportunities.summary.staleDeal'), value: s?.stale ?? 0,
      color: s?.stale ? OPP_COLOR.staleDeal : undefined,
      sub: s?.stale_days != null ? t('thresholdDays', { n: s.stale_days }) : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.staleDeal'), s?.stale ?? 0, 'stale')) },
    closingSoon: { key: 'closingSoon', label: t('opportunities.summary.closingSoon'), value: s?.closing_soon ?? 0,
      color: s?.closing_soon ? OPP_COLOR.closingSoon : undefined,
      sub: s?.closing_soon_days != null ? t('thresholdDays', { n: s.closing_soon_days }) : undefined,
      onClick: gateDrillClick('opportunities', () => openKpiDrill(t('opportunities.summary.closingSoon'), s?.closing_soon ?? 0, 'closing_soon')) },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('opportunities').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('opportunities')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('opportunities'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — pipeline health, above the tabs (candidate-page order) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('opportunities.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B). */}
      {!loading && !error && data && (
        <BodyText style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('opportunities.window', { from: formatDate(data.period.from), to: formatDate(data.period.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('opportunities.loading')} errorLabel={t('opportunities.error')} emptyLabel={t('opportunities.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Created over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('opportunities.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Stage axis — a lookup axis with its own colour per value → donut,
              always sums to total ('none' + orphan-uuid rows included). */}
          <ReportChartCard title={t('applications.axes.stage')} chart={stageDonut(data.by_stage)} />

          {/* Top-20 customers + 'others' + 'none' — a ranking axis → bar; a
              hard-deleted customer's "Onbekend" bar still drills on its raw uuid. */}
          <ReportChartCard title={t('applications.axes.customer')} chart={bars('customer', data.by_customer)} />

          <ReportChartCard title={t('customers.axes.owner')} chart={ownerBars(data.by_owner)} />

          {/* Branch axis on the deal's OWN location_id column (unlike vacancies,
              no customer detour) — a ranking axis → bar; drills via the report
              `branch` param. */}
          <ReportChartCard title={t('customers.axes.branch')} chart={bars('branch', data.by_branch)} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
