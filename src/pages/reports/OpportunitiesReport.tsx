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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import { BodyText } from '@/components/ui/typography'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOpportunitiesReport } from './useOpportunitiesReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { useNumberFormat, formatPercent } from '@/lib/formatters'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The three plain single-value XOR axes; `owner` has its own D2 shape below.
type Axis = 'stage' | 'customer' | 'branch'

// Every drillable section on this page, each owning its OWN always-visible list
// (ReportChartWithDrillList) — one key per section, never a single global `drill`.
type DrillKey = Axis | 'owner' | 'series'

// Minimal surface the generic bar renderer needs — stage rows carry a lookup
// colour, customer/branch rows do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

export default function OpportunitiesReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { formatCurrency } = useNumberFormat()
  const { data, loading, error, refetch } = useOpportunitiesReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: every axis section and the timeseries own an ALWAYS-VISIBLE list
  // beside their chart (ReportChartWithDrillList) instead of a shared overlay — so
  // one key per section, never a single global `drill`. Exactly one XOR param per
  // open drill.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const windowSub = () => `${formatDate(data?.period.from)} – ${formatDate(data?.period.to)}`
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/opportunities/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/opportunities/advice', adviceParams: { ...xorParam, period },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/opportunities/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/opportunities/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  } }))

  // Generic axis-bar renderer: 'none'/'others' sentinels and orphaned (deleted-
  // lookup) values are all normal array entries — each drills on its RAW value,
  // exactly like any other segment (no special-casing, see SegmentBars).
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('opportunities', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color ?? null }))} />
  }

  // Owner axis (D2 shape: owner_id/name → the `owner` param).
  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('opportunities', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment('owner', { label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('opportunities', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topStage = top(data.by_stage, s => s.count)
    const topCustomer = top(data.by_customer, s => s.count)
    const topOwner = top(data.by_owner, s => s.count)
    const topBranch = top(data.by_branch, s => s.count)
    if (topStage) openSegment('stage', topStage, { stage: topStage.value })
    if (topCustomer) openSegment('customer', topCustomer, { customer: topCustomer.value })
    if (topOwner) openSegment('owner', { label: topOwner.name, count: topOwner.count }, { owner: topOwner.owner_id })
    if (topBranch) openSegment('branch', topBranch, { branch: topBranch.value })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.period.from, data?.period.to])

  // Pipeline-health KPI strip from the envelope's totals. Not drillable: the
  // five-way XOR carries no open/won/lost segment (no fake affordances). win_rate
  // is null until a deal is decided — placeholder, never a fabricated 0%.
  // Nine-card footprint (Danny — same as the dashboard). The pipeline five stay
  // as-is; the stale-deal counters and the forecast totals are real sums over
  // fields the endpoint already returns (`stale` and `forecast[]`) — neither is
  // a drillable XOR axis today, so both render as plain, honest, non-clickable
  // stats rather than a dead button (no fake affordances).
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
    total:   { key: 'total',   label: t('opportunities.total'),           value: total },
    open:    { key: 'open',    label: t('opportunities.summary.open'),    value: s?.open ?? 0 },
    won:     { key: 'won',     label: t('opportunities.summary.won'),     value: s?.won ?? 0 },
    lost:    { key: 'lost',    label: t('opportunities.summary.lost'),    value: s?.lost ?? 0 },
    winRate: { key: 'winRate', label: t('opportunities.summary.winRate'),
      value: formatPercent(s?.win_rate) },
    untouched: { key: 'untouched', label: t('opportunities.stale.untouched'), value: data?.stale.untouched ?? 0 },
    overdue:   { key: 'overdue',   label: t('opportunities.stale.overdue'),   value: data?.stale.overdue ?? 0 },
    forecastCount: { key: 'forecastCount', label: t('opportunities.forecastCount'), value: forecastCount },
    forecastValue: { key: 'forecastValue', label: t('opportunities.forecastValue'), value: formatCurrency(forecastValue, 'EUR', 0) },
    // Spares: real money fields already in `totals` (money via formatCurrency,
    // never a raw number) + the two top-segment picks above.
    openValue: { key: 'openValue', label: t('opportunities.summary.openValue'), value: formatCurrency(s?.open_value ?? 0, 'EUR', 0) },
    wonValue:  { key: 'wonValue',  label: t('opportunities.summary.wonValue'),  value: formatCurrency(s?.won_value ?? 0, 'EUR', 0) },
    topStage: { key: 'topStage', label: t('opportunities.summary.topStage'),
      value: topStage ? `${topStage.label} · ${topStage.count}` : '—',
      onClick: topStage ? gateDrillClick('opportunities', () => openSegment('stage', topStage, { stage: topStage.value })) : undefined },
    topCustomer: { key: 'topCustomer', label: t('opportunities.summary.topCustomer'),
      value: topCustomer ? `${topCustomer.label} · ${topCustomer.count}` : '—',
      onClick: topCustomer ? gateDrillClick('opportunities', () => openSegment('customer', topCustomer, { customer: topCustomer.value })) : undefined },
    // KPI-DREMPELS-FE-1: totals.stale / totals.closing_soon (additive, distinct from
    // the older top-level `stale` object above — a different, updated_at-based
    // contract left untouched), each with its own tenant day-threshold caption. No
    // XOR param exists for either signal on this report's five-way drill, so both
    // render as plain, honest, non-clickable stats — the same rule the untouched/
    // overdue tiles above already follow (no fake affordances).
    staleDeal: { key: 'staleDeal', label: t('opportunities.summary.staleDeal'), value: s?.stale ?? 0,
      sub: s?.stale_days != null ? t('thresholdDays', { n: s.stale_days }) : undefined },
    closingSoon: { key: 'closingSoon', label: t('opportunities.summary.closingSoon'), value: s?.closing_soon ?? 0,
      sub: s?.closing_soon_days != null ? t('thresholdDays', { n: s.closing_soon_days }) : undefined },
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

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('opportunities.loading')} errorLabel={t('opportunities.error')} emptyLabel={t('opportunities.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. Its
                own always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('opportunities.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('opportunities.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            {/* Stage axis — always sums to total ('none' + orphan-uuid rows included). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.stage')}</h3>
              <ReportChartWithDrillList drill={drills.stage ?? null} placeholderLabel={t('applications.axes.stage')}
                chart={bars('stage', data.by_stage)} />
            </section>

            {/* Top-20 customers + 'others' + 'none'; a hard-deleted customer's
                "Onbekend" bar still drills on its raw uuid. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('applications.axes.customer')}</h3>
              <ReportChartWithDrillList drill={drills.customer ?? null} placeholderLabel={t('applications.axes.customer')}
                chart={bars('customer', data.by_customer)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.owner')}</h3>
              <ReportChartWithDrillList drill={drills.owner ?? null} placeholderLabel={t('customers.axes.owner')}
                chart={ownerBars(data.by_owner)} />
            </section>

            {/* Branch axis on the deal's OWN location_id column (unlike vacancies,
                no customer detour) — drills via the report `branch` param. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.branch')}</h3>
              <ReportChartWithDrillList drill={drills.branch ?? null} placeholderLabel={t('customers.axes.branch')}
                chart={bars('branch', data.by_branch)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
