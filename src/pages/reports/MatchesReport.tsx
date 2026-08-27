/**
 * MatchesReport — matches summary (GET /reports/matches, closed by RAPPORTEN-SUITE-1
 * "portie 7"). KPI-MATCHES-1 (CMBE 27-08): the strip now reads the server's own
 * nine-card kpis[] suite verbatim (total/new_in_period/active/expiring_soon/
 * terminated_in_period/renewals_in_period/without_end_date/avg_duration_days/
 * reach_rate), mirroring TasksReport/OutreachReport. Below the strip: the shared
 * timeseries, the contract-form axis (MATCH-SOORT-1), the under_contract
 * contract-status tiles and the terminations-by-reason axis — untouched by the
 * strip migration. Their own drill/advice XOR params still follow the four-way
 * contract: origin | contract_form | contract_status | date (+bucket=week next
 * to a week bar's date) | stop_reason. `avg_placement_duration_days` is honestly
 * null until the HelloFlex coupling fills match start/end.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import ReportStateBlock from './ReportStateBlock'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useMatchesReport } from './useMatchesReport'
import { gateDrillClick } from './reportDrillGate'
import { EMPTY_REPORT_FILTERS, buildReportQueryParams } from './reportFilterParams'
import type { ReportFilterState } from './reportFilterParams'
import PieChartCard from '@/components/charts/PieChartCard'
import { CHART_SERIES_COLORS } from '@/components/charts/chartTypes'
import type { ChartDatum } from '@/components/charts/chartTypes'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateTimeseriesPoint, CandidateSegment, MatchTerminationReasonSegment } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'
import SharedStatTile from '@/components/ui/StatTile'
import { BodyText } from '@/components/ui/typography'
import { formatKpiUnitValue } from './kpiUnitFormat'
import type { KpiUnit } from './kpiUnitFormat'

// One match stat tile; with an onClick it becomes a drillable surface (keyboard
// operable — same affordance pattern as SegmentBars).
// The shared StatTile atom (klus c) — value-first, clickable, accent for the live bucket.
function StatTile({ label, value, accent, onClick }: { label: string; value: number; accent?: boolean; onClick?: () => void }) {
  return <SharedStatTile label={label} value={value} accent={accent} onClick={onClick} />
}

// The under_contract tile keys — each drills contract_status=<key> (portie 7 XOR).
const CONTRACT_STATUS_TILES = ['sent', 'active', 'ended', 'none'] as const

// Matches report page: KPI strip plus charts, wired to the shared period/filters/compare params every reports page shares.
export default function MatchesReport({ period, filters = EMPTY_REPORT_FILTERS, compare = COMPARE_OFF }: { period: ReportPeriod; filters?: ReportFilterState; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useMatchesReport(period, filters)
  const isEmpty = !loading && !error && (!data || data.total === 0)

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('matches')
  const compareBaseParams = { ...buildReportQueryParams(period, 'matches', filters) }
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, compareBaseParams)
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // Drill-down: clicking a KPI/segment/tile/bucket explains it (breakdown + the
  // matches behind it + Koios advice). Exactly one XOR param per open drill —
  // ALWAYS layered on top of the report's own active filters (`baseParams`), never
  // just `period`, so the lade counts the exact same set the bar was drawn from.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  // The report window from the RESPONSE, DD-MM-YYYY (§3B DATUM-1) — drawer subtitle.
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const baseParams = buildReportQueryParams(period, 'matches', filters)

  // Soort-as (MATCH-SOORT-1): by_contract_form — a lookup axis with its own
  // colour per value (CHART-TYPE RULE) → donut, `contract_form` is one leg
  // of the four-way XOR; drill AND advice both carry it (the advice gap the
  // backend closed in portie 7 — labels read "Contractvorm: …" server-side).
  const openContractForm = (label: string, value: number, slug: string) => setDrill({
    title: label, value, subtitle: windowSub(),
    entityPage: 'matches',
    rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, contract_form: slug },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, contract_form: slug },
  })
  const contractFormSegs = data?.by_contract_form ?? []
  // Donut data builder — each lookup value wears its OWN colour, house series as fallback.
  const donutData = (segs: CandidateSegment[]): { data: ChartDatum[]; colors: string[] } => ({
    data: segs.map(s => ({ name: s.label, value: s.count, key: s.value })),
    colors: segs.map((s, i) => s.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]),
  })
  // Origin donut (herkomst: via funnel vs. direct match) — restores by_origin's
  // display surface after the old origin KPI cards retired with the strip flip;
  // static two-value axis, so house series colours, and each slice drills the
  // origin XOR leg the panel filter already speaks.
  const originSegs: CandidateSegment[] = data ? [
    { value: 'funnel', label: t('matches.viaFunnel'), count: data.by_origin.funnel, color: null },
    { value: 'direct', label: t('matches.direct'), count: data.by_origin.direct, color: null },
  ] : []
  const onOriginPick = gateDrillClick('matches', (d: unknown) => {
    const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
    const seg = originSegs.find(s => s.value === key)
    if (!seg) return
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(), entityPage: 'matches',
      rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, origin: seg.value },
      adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, origin: seg.value },
    })
  })
  const onContractFormPick = gateDrillClick('matches', (d: unknown) => {
    const key = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
    const seg = contractFormSegs.find(s => s.value === key)
    if (seg) openContractForm(seg.label, seg.count, seg.value)
  })

  // Under-contract tile drill: `contract_status` is the third XOR leg (portie 7).
  const openContractStatus = (label: string, value: number, key: (typeof CONTRACT_STATUS_TILES)[number]) => setDrill({
    title: label, value, subtitle: windowSub(),
    entityPage: 'matches',
    rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, contract_status: key },
    adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, contract_status: key },
  })
  // 'none' now arrives explicitly in the envelope (7925ce15); the old derivation
  // stays as fallback for a cached pre-update response, never fabricated.
  const noContract = data?.under_contract.none ?? Math.max(0, (data?.total ?? 0) - (data?.under_contract.total ?? 0))
  const tileValue = (key: (typeof CONTRACT_STATUS_TILES)[number]) =>
    key === 'none' ? noContract : data?.under_contract[key] ?? 0

  // Timeseries bucket drill: `date` is the fourth XOR leg; a week bar widens the
  // drawer to the WHOLE week (bucket=week) so bar and drawer totals always agree.
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    rowsEndpoint: '/reports/matches/drill',
    rowsParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
    adviceEndpoint: '/reports/matches/advice',
    adviceParams: { ...baseParams, date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}) },
  })
  const onSeriesPick = gateDrillClick('matches', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Terminations by stop reason — stop_reason is the FIFTH XOR leg (7925ce15).
  // The axis is windowed on the termination EVENT server-side, so the drawer shows
  // the matches whose termination fell in the window: drawer == bar, always.
  const terminationSegs = data?.terminations.by_reason ?? []
  const openReason = gateDrillClick('matches', (d: unknown) => {
    const value = (d as { key?: string })?.key ?? (d as { payload?: { key?: string } })?.payload?.key
    const seg = terminationSegs.find((s: MatchTerminationReasonSegment) => s.value === value)
    // Reference guard: an unresolved datum never opens a drill on a raw key.
    if (!seg) return
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      entityPage: 'matches',
      rowsEndpoint: '/reports/matches/drill', rowsParams: { ...baseParams, stop_reason: seg.value },
      adviceEndpoint: '/reports/matches/advice', adviceParams: { ...baseParams, stop_reason: seg.value },
    })
  })

  // KPI-MATCHES-1 (CMBE 27-08, BuildsMatchKpis): the strip reads the server's
  // own nine-card kpis[] suite verbatim — mirrors TasksReport/OutreachReport's
  // KPI-TAKEN-1 idiom (kpiByServerKey Map, one predicate shared by value and
  // drill). A key the server omitted (or a pre-suite cached envelope) renders
  // the house dash with no drill — never a value from another population. The
  // origin/contract-status/terminations DATA keeps a chart surface below: the
  // origin DONUT (restored when the old origin KPI cards retired — its panel
  // filter and drill leg predate the strip flip), the StatTiles and the
  // terminations donut.
  const kpiByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.count]))
  const openKpiDrill = (kpi: string, label: string, value: string | number) =>
    gateDrillClick('matches', () => setDrill({
      title: label, value, subtitle: windowSub(), entityPage: 'matches',
      rowsEndpoint: '/reports/matches/kpis/drill', rowsParams: { ...baseParams, kpi },
    }))
  // Semantic colour only where the number is a SIGNAL and non-zero (§4: colour
  // carries meaning; a calm zero stays uncoloured).
  const KPI_COLOR: Partial<Record<string, string>> = {
    expiring_soon: 'var(--color-warning)', terminated_in_period: 'var(--color-danger)',
    active: 'var(--color-success)',
  }
  const SUITE_LABEL_KEY: Record<string, string> = {
    total: 'matches.kpi.total', new_in_period: 'matches.kpi.newInPeriod', active: 'matches.kpi.active',
    expiring_soon: 'matches.kpi.expiringSoon', terminated_in_period: 'matches.kpi.terminatedInPeriod',
    renewals_in_period: 'matches.kpi.renewalsInPeriod', without_end_date: 'matches.kpi.withoutEndDate',
    avg_duration_days: 'matches.kpi.avgDurationDays', reach_rate: 'matches.kpi.reachRate',
  }
  // UNIT-CANON (FRONTEND-CONTRACT §13, REPORT-KPI-STRIP-1): the SERVER's unit
  // field on each kpis[] entry decides the formatting; the local map is only the
  // tolerant fallback for a cached pre-unit envelope (§10) — never the source.
  const KPI_UNIT_FALLBACK: Partial<Record<string, KpiUnit>> = { avg_duration_days: 'days', reach_rate: 'ratio' }
  const unitByServerKey = new Map((data?.kpis ?? []).map(k => [k.key, k.unit ?? KPI_UNIT_FALLBACK[k.key]]))
  const openKpiParams = drill?.rowsParams as Record<string, unknown> | undefined
  const kpiByKey: Record<string, KpiSpec> = Object.fromEntries(
    Object.entries(SUITE_LABEL_KEY).map(([key, labelKey]) => {
      const label = t(labelKey)
      const raw = kpiByServerKey.get(key)
      const has = raw != null
      const unit = unitByServerKey.get(key)
      const value = !has ? '—' : unit ? formatKpiUnitValue(raw, unit) : raw
      return [key, {
        key, label, value,
        color: has && raw !== 0 ? KPI_COLOR[key] : undefined,
        active: openKpiParams?.kpi === key,
        sub: key === 'total' && totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
        onClick: has ? openKpiDrill(key, label, value) : undefined,
      } satisfies KpiSpec]
    }))
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('matches').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('matches')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('matches'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {!loading && !error && !isEmpty && data && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('matches.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). 500 = the top of §4's body/label
          weight range: an emphasized data line, not a heading. */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('matches.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(loading || error || isEmpty) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={isEmpty}
            loadingLabel={t('matches.loading')} errorLabel={t('matches.error')} emptyLabel={t('matches.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {!loading && !error && !isEmpty && data && (
        <ReportGrid>
          {/* Matches over time — week/day timeseries, bucket set server-side;
              every bar drills on its own date key (portie 7). */}
          <ReportChartCard span={2} title={t('matches.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Soort-as (MATCH-SOORT-1): a lookup axis with its own colour per value
              (CHART-TYPE RULE) → donut, sums to total incl. the 'none' sentinel
              and any orphaned slug. */}
          <ReportChartCard title={t('matches.axes.contractForm')} chart={
            <PieChartCard {...donutData(contractFormSegs)} onItemClick={onContractFormPick} />
          } />

          {/* Herkomst-as: two-value static axis (funnel vs. direct) → donut; every
              slice drills origin=<key> (the XOR leg the right-panel filter shares). */}
          <ReportChartCard title={t('matches.axes.origin')} chart={
            <PieChartCard {...donutData(originSegs)} onItemClick={onOriginPick} />
          } />

          {/* Contract-status tiles (under_contract, MATCH-VOCABULAIRE-1): the four
              tiles sum to the report total and each drills contract_status=<key>. */}
          <ReportChartCard span={2} title={t('matches.placements.title')} chart={
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {CONTRACT_STATUS_TILES.map(key => (
                  <StatTile key={key} label={t(`matches.placements.${key}`)} value={tileValue(key)} accent={key === 'active'}
                    onClick={gateDrillClick('matches', () => openContractStatus(t(`matches.placements.${key}`), tileValue(key), key))} />
                ))}
              </div>
              {data.avg_placement_duration_days == null && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>{t('matches.durationNote')}</p>
              )}
            </>
          } />

          {/* Terminations by stop reason — a lookup axis with its own colour per
              value (CHART-TYPE RULE) → donut, zero-filled over every active
              reason; each slice drills stop_reason=<value> (fifth XOR leg,
              7925ce15). Last card of an odd tail spans the full row. */}
          <ReportChartCard span={2} title={t('matches.terminations.title')} chart={
            <PieChartCard {...donutData(terminationSegs.map(s => ({ value: s.value, label: s.label, color: s.color, count: s.count })))}
              onItemClick={openReason} />
          } />
        </ReportGrid>
      )}

      {/* Dynamic drill-down: explains the clicked number + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
