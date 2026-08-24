/**
 * OutreachReport — call-list outreach report (GET /reports/outreach, REPORTS-2
 * fase 1 upgraded by RAPPORTEN-SUITE-1 "portie 6"). Mirrors OpportunitiesReport /
 * TasksReport 1:1: calm bars via the shared SegmentBars (the fase-1 hand-rolled
 * `Bars` is gone), the window rendered prominently from the RESPONSE. Drill XOR
 * params follow the six-way outreach contract: campaign|assignee|channel|status|
 * outcome|date (+bucket=week next to a week bar's date). Every axis sums to
 * `total`; 'none'/'others' sentinels, "Onbekend"/"Geen uitkomst" rows and orphan
 * strings are normal, drillable bars — campaign accepts any uuid (an archived
 * campaign keeps its real name) and 'others' drills the exact top-20 complement.
 * The fase-1 KPI strip (targets/reached/reach rate) stays as-is; drill rows carry
 * candidate names (outreach.view), so a 403 keeps the calm degrade in the drawer.
 */
import { useState } from 'react'
import { BodyText } from '@/components/ui/typography'
import { formatRatio } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import ReportGrid from './ReportGrid'
import ReportChartCard from './ReportChartCard'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOutreachReport } from './useOutreachReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'
import { getCompareSlug } from './reportCompareSupport'
import { useReportCompare } from './useReportCompare'
import ReportCompareMetric from './ReportCompareMetric'
import { COMPARE_OFF } from './reportCompareMode'
import type { ReportCompareMode } from './reportCompareMode'

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'campaign' | 'channel' | 'status' | 'outcome'

// Minimal surface the generic bar renderer needs — outreach axes carry no lookup
// colour (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number }

export default function OutreachReport({ period, compare = COMPARE_OFF }: { period: ReportPeriod; compare?: ReportCompareMode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useOutreachReport(period)

  const total   = data?.total ?? data?.total_targets ?? 0
  const hasData = !loading && !error && total > 0

  // RAPPORT-COMPARE-1: mirrors CandidatesReport's hosting exactly.
  const compareSlug = getCompareSlug('outreach')
  const { data: compareData } = useReportCompare(compareSlug, data?.from, data?.to, compare, { period })
  const totalCompare = compare.kind !== 'off' ? (compareData?.total as { current: number; previous: number; delta: number; delta_pct: number | null } | undefined) : undefined

  // One shared drawer for the whole page — a KPI-card click and an axis/bucket
  // click both open the SAME drawer (replacing whatever was open before). Exactly
  // one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrill({
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/outreach/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/outreach/advice', adviceParams: { ...xorParam, period },
    })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/outreach/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/outreach/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  // Generic axis-bar renderer: 'none'/'others' sentinels, "Onbekend"/"Geen
  // uitkomst" rows and orphan strings are all normal array entries — each drills
  // on its RAW value, exactly like any other segment (no special-casing, see
  // SegmentBars). An archived campaign keeps its name and drills on its uuid.
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('outreach', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: null }))} />
  }

  // Assignee axis (D2 shape: owner_id/name → the `assignee` param; a NULL
  // assignee arrives as the 'none' row, "Niet toegewezen").
  const assigneeBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('outreach', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { assignee: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  // RAPPORT-KAARTDRILLS-1 → Opus-REJECT gemeten: alleen total/reached zijn
  // hard bevestigd identiek aan hun server-kpi; notReached (kaart = rekenkundig
  // complement, server = uitkomst-subset) en rate (kaart = reach_rate, sleutel
  // = conversion_pct met andere noemer) divergeren en zijn ontkoppeld tot de
  // kaartwaarden uit de server-kpis[]-strip komen (rapportenplan-uitrol).
  const KPI_DRILL_KEY: Partial<Record<string, string>> = {
    total: 'total_targets', reached: 'reached',
  }
  const openKpiDrill = (localKey: string, label: string, value: string | number) => {
    const serverKey = KPI_DRILL_KEY[localKey]
    if (!serverKey) return undefined
    return gateDrillClick('outreach', () => setDrill({
      title: label, value, subtitle: windowSub(),
      rowsEndpoint: '/reports/outreach/kpis/drill', rowsParams: { kpi: serverKey, period },
    }))
  }

  const onSeriesPick = gateDrillClick('outreach', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Fase-1 KPI strip, unchanged (regression): reach_rate is null while nothing
  // was reached — placeholder, never a fabricated 0%. Display-only: the six-way
  // XOR carries no reached/rate segment (no fake affordances).
  const targets = data?.total_targets ?? 0
  const reached = data?.reached ?? 0
  const unassignedSeg   = data?.by_assignee.find(s => s.owner_id === 'none')
  const unassignedCount = unassignedSeg?.count ?? 0
  const noOutcomeSeg    = data?.by_outcome.find(s => s.value === 'none')
  // Top-1 real bar per axis (excl. the structural 'others'/'none' sentinels) —
  // never a hardcoded outcome/campaign/channel value, just the biggest real one.
  const topCampaign = data?.by_campaign.filter(s => s.value !== 'others').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  const topChannel = data?.by_channel.filter(s => s.value !== 'none').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  // Spares (REPORTS-KPI-SPARES-1): the top real segment of two axes not yet
  // offered (by_status/by_outcome, excluding the 'none' sentinel already used by
  // noOutcome above), and three distinct-category counts off axes already in the
  // response (campaigns/channels/assignees actually used, i.e. count > 0).
  const topStatus = data?.by_status.reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  const topOutcome = data?.by_outcome.filter(s => s.value !== 'none').reduce<{ value: string; label: string; count: number } | null>(
    (top, s) => (!top || s.count > top.count) ? s : top, null)
  const campaignsCount  = data?.by_campaign.filter(s => s.value !== 'others' && s.count > 0).length ?? 0
  const channelsUsedCount = data?.by_channel.filter(s => s.value !== 'none' && s.count > 0).length ?? 0
  const assigneesCount  = data?.by_assignee.filter(s => s.owner_id !== 'none' && s.count > 0).length ?? 0
  const kpiByKey: Record<string, KpiSpec> = {
    total:   { key: 'total',   label: t('outreach.total'),   value: targets,
      sub: totalCompare ? <ReportCompareMetric metric={totalCompare} polarity="up-good" /> : undefined,
      onClick: openKpiDrill('total', t('outreach.total'), targets) },
    reached: { key: 'reached', label: t('outreach.reached'), value: reached,
      onClick: openKpiDrill('reached', t('outreach.reached'), reached) },
    rate:    { key: 'rate',    label: t('outreach.reachRate'),
      value: formatRatio(data?.reach_rate),
      onClick: data?.reach_rate != null ? openKpiDrill('rate', t('outreach.reachRate'), formatRatio(data.reach_rate)) : undefined },
    // Derived complements — real subtraction over fields the endpoint returns,
    // never a fabricated number. `assigned` stays non-clickable: no single-value
    // axis or kpi backs an "assigned" drill.
    notReached: { key: 'notReached', label: t('outreach.summary.notReached'), value: targets - reached,
      onClick: openKpiDrill('notReached', t('outreach.summary.notReached'), targets - reached) },
    assigned:   { key: 'assigned',   label: t('outreach.summary.assigned'),   value: targets - unassignedCount },
    unassigned: { key: 'unassigned', label: t('outreach.summary.unassigned'), value: unassignedCount,
      onClick: unassignedSeg ? gateDrillClick('outreach', () => openSegment({ label: unassignedSeg.name, count: unassignedSeg.count }, { assignee: 'none' })) : undefined },
    noOutcome: { key: 'noOutcome', label: t('outreach.summary.noOutcome'), value: noOutcomeSeg?.count ?? 0,
      onClick: noOutcomeSeg ? gateDrillClick('outreach', () => openSegment(noOutcomeSeg, { outcome: 'none' })) : undefined },
    // Permanent slots (Danny — nine cards, always): while there is no real top
    // campaign/channel yet, the card still renders with the house dash instead
    // of shrinking the strip.
    topCampaign: { key: 'topCampaign', label: t('outreach.summary.topCampaign'), value: topCampaign?.count ?? '—', sub: topCampaign?.label,
      onClick: topCampaign ? gateDrillClick('outreach', () => openSegment(topCampaign, { campaign: topCampaign.value })) : undefined },
    topChannel: { key: 'topChannel', label: t('outreach.summary.topChannel'), value: topChannel?.count ?? '—', sub: topChannel?.label,
      onClick: topChannel ? gateDrillClick('outreach', () => openSegment(topChannel, { channel: topChannel.value })) : undefined },
    topStatus: { key: 'topStatus', label: t('outreach.summary.topStatus'), value: topStatus?.count ?? '—', sub: topStatus?.label,
      onClick: topStatus ? gateDrillClick('outreach', () => openSegment(topStatus, { status: topStatus.value })) : undefined },
    topOutcome: { key: 'topOutcome', label: t('outreach.summary.topOutcome'), value: topOutcome?.count ?? '—', sub: topOutcome?.label,
      onClick: topOutcome ? gateDrillClick('outreach', () => openSegment(topOutcome, { outcome: topOutcome.value })) : undefined },
    campaignsCount: { key: 'campaignsCount', label: t('outreach.summary.campaignsCount'), value: campaignsCount },
    channelsUsed: { key: 'channelsUsed', label: t('outreach.summary.channelsUsed'), value: channelsUsedCount },
    assigneesCount: { key: 'assigneesCount', label: t('outreach.summary.assigneesCount'), value: assigneesCount },
  }
  // Which nine keys render, and in what order, is the tenant's Settings → Reports
  // choice (falls back to today's order when nothing is stored, or a stored key
  // has vanished — RAPPORT-KPI-INSTELBAAR).
  const settingsValues = useAllSettings()
  const catalogKeys = getReportKpiCatalog('outreach').map(c => c.key)
  const defaultOrder = getReportKpiDefaultOrder('outreach')
  const stored = getJsonSetting<string[] | undefined>(settingsValues, reportKpiSettingsKey('outreach'), undefined)
  const { order: kpiOrder, fellBack } = resolveReportKpiOrder(stored, catalogKeys, defaultOrder)
  const kpis: KpiSpec[] = kpiOrder.map(key => kpiByKey[key]).filter((k): k is KpiSpec => k != null)

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {hasData && (
        <ReportKpiBand kpis={kpis} notice={fellBack ? t('outreach.kpiOrderFellBack') : undefined} />
      )}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <BodyText as="div" style={{ fontWeight: 500, marginBottom: 12 }}>
          {t('outreach.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </BodyText>
      )}

      {(!hasData || !data) && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <ReportStateBlock
            loading={loading} error={error} empty={!loading && !error && total === 0}
            loadingLabel={t('outreach.loading')} errorLabel={t('outreach.error')} emptyLabel={t('outreach.empty')}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {hasData && data && (
        <ReportGrid>
          {/* Targets over time — week/day timeseries, bucket set server-side. */}
          <ReportChartCard span={2} title={t('outreach.series')}
            chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />

          {/* Top-20 call lists + 'others' (the exact complement, a real row);
              an archived campaign keeps its name and drills on its uuid. */}
          <ReportChartCard title={t('outreach.axes.campaign')} chart={bars('campaign', data.by_campaign)} />
          <ReportChartCard title={t('tasks.axes.assignee')} chart={assigneeBars(data.by_assignee)} />

          {/* Channel axis, zero-filled over the tenant channels + 'none'. */}
          <ReportChartCard title={t('outreach.axes.channel')} chart={bars('channel', data.by_channel)} />

          {/* Status axis — the fase-1 breakdown, now summing to total with
              value/label pairs ("Onbekend" orphan bars included). */}
          <ReportChartCard title={t('customers.axes.status')} chart={bars('status', data.by_status)} />

          {/* Outcome axis — incl. the "Geen uitkomst" sentinel so it sums to total. */}
          <ReportChartCard title={t('outreach.axes.outcome')} chart={bars('outcome', data.by_outcome)} />
        </ReportGrid>
      )}

      {/* One shared drill drawer for the whole page. */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
