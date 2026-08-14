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
import { useEffect, useState } from 'react'
import { formatRatio } from '@/lib/formatters'
import { useTranslation } from 'react-i18next'
import ReportKpiBand from './ReportKpiBand'
import { reportCardStyle as card, reportSectionHeadStyle as head } from './ReportSectionCard'
import ReportStateBlock from './ReportStateBlock'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOutreachReport } from './useOutreachReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportChartWithDrillList from './ReportChartWithDrillList'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'
import { useAllSettings, getJsonSetting } from '@/lib/settings/useAllSettings'
import { getReportKpiCatalog, getReportKpiDefaultOrder, reportKpiSettingsKey } from './kpiCatalog'
import { resolveReportKpiOrder } from './resolveReportKpiOrder'

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'campaign' | 'channel' | 'status' | 'outcome'
// The assignee axis shares the drill-key record with the four plain axes plus the timeseries.
type DrillKey = Axis | 'assignee' | 'series'

// Minimal surface the generic bar renderer needs — outreach axes carry no lookup
// colour (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number }

export default function OutreachReport({ period }: { period: ReportPeriod }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error, refetch } = useOutreachReport(period)

  const total   = data?.total ?? data?.total_targets ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // call-list targets behind it + Koios advice). Exactly one XOR param per open drill.
  const [drills, setDrills] = useState<Partial<Record<DrillKey, DrillSpec>>>({})
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (key: DrillKey, seg: { label: string; count: number }, xorParam: Record<string, unknown>) =>
    setDrills(d => ({ ...d, [key]: {
      title: seg.label, value: seg.count, subtitle: windowSub(),
      rowsEndpoint: '/reports/outreach/drill', rowsParams: { ...xorParam, period },
      adviceEndpoint: '/reports/outreach/advice', adviceParams: { ...xorParam, period },
    } }))
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrills(d => ({ ...d, series: {
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the list then counts the WHOLE
    // week (bucket=week) so bar and list total always agree.
    rowsEndpoint: '/reports/outreach/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/outreach/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  } }))

  // Generic axis-bar renderer: 'none'/'others' sentinels, "Onbekend"/"Geen
  // uitkomst" rows and orphan strings are all normal array entries — each drills
  // on its RAW value, exactly like any other segment (no special-casing, see
  // SegmentBars). An archived campaign keeps its name and drills on its uuid.
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('outreach', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(axis, seg, { [axis]: value })
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
      if (seg) openSegment('assignee', { label: seg.name, count: seg.count }, { assignee: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('outreach', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Default each section's list to its own top segment on mount so no panel is
  // ever blank — mirrors clicking that segment's own bar, never a client-side guess.
  useEffect(() => {
    if (!data) return
    const top = <T,>(segs: T[], count: (s: T) => number) => segs.length ? segs.reduce((a, b) => (count(b) > count(a) ? b : a)) : null
    const topCampaign = top(data.by_campaign.filter(s => s.value !== 'others'), s => s.count)
    const topChannel = top(data.by_channel, s => s.count)
    const topStatus = top(data.by_status, s => s.count)
    const topOutcome = top(data.by_outcome, s => s.count)
    const topAssignee = top(data.by_assignee, s => s.count)
    if (topCampaign) openSegment('campaign', topCampaign, { campaign: topCampaign.value })
    if (topChannel) openSegment('channel', topChannel, { channel: topChannel.value })
    if (topStatus) openSegment('status', topStatus, { status: topStatus.value })
    if (topOutcome) openSegment('outcome', topOutcome, { outcome: topOutcome.value })
    if (topAssignee) openSegment('assignee', { label: topAssignee.name, count: topAssignee.count }, { assignee: topAssignee.owner_id })
    if (data.timeseries.series.length) openBucket(data.timeseries.series[data.timeseries.series.length - 1])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.from, data?.to])

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
  const kpiByKey: Record<string, KpiSpec> = {
    total:   { key: 'total',   label: t('outreach.total'),   value: targets },
    reached: { key: 'reached', label: t('outreach.reached'), value: reached },
    rate:    { key: 'rate',    label: t('outreach.reachRate'),
      value: formatRatio(data?.reach_rate) },
    // Derived complements — real subtraction over fields the endpoint returns,
    // never a fabricated number. Not clickable: no single-value axis backs a
    // "not reached"/"assigned" drill.
    notReached: { key: 'notReached', label: t('outreach.summary.notReached'), value: targets - reached },
    assigned:   { key: 'assigned',   label: t('outreach.summary.assigned'),   value: targets - unassignedCount },
    unassigned: { key: 'unassigned', label: t('outreach.summary.unassigned'), value: unassignedCount,
      onClick: unassignedSeg ? gateDrillClick('outreach', () => openSegment('assignee', { label: unassignedSeg.name, count: unassignedSeg.count }, { assignee: 'none' })) : undefined },
    noOutcome: { key: 'noOutcome', label: t('outreach.summary.noOutcome'), value: noOutcomeSeg?.count ?? 0,
      onClick: noOutcomeSeg ? gateDrillClick('outreach', () => openSegment('outcome', noOutcomeSeg, { outcome: 'none' })) : undefined },
    // Permanent slots (Danny — nine cards, always): while there is no real top
    // campaign/channel yet, the card still renders with the house dash instead
    // of shrinking the strip.
    topCampaign: { key: 'topCampaign', label: t('outreach.summary.topCampaign'), value: topCampaign?.count ?? '—', sub: topCampaign?.label,
      onClick: topCampaign ? gateDrillClick('outreach', () => openSegment('campaign', topCampaign, { campaign: topCampaign.value })) : undefined },
    topChannel: { key: 'topChannel', label: t('outreach.summary.topChannel'), value: topChannel?.count ?? '—', sub: topChannel?.label,
      onClick: topChannel ? gateDrillClick('outreach', () => openSegment('channel', topChannel, { channel: topChannel.value })) : undefined },
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
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('outreach.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <ReportStateBlock
          loading={loading} error={error} empty={!loading && !error && total === 0}
          loadingLabel={t('outreach.loading')} errorLabel={t('outreach.error')} emptyLabel={t('outreach.empty')}
          onRetry={() => refetch()}
        />
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Targets over time — week/day timeseries, bucket set server-side. Its own
                always-visible list sits beside it, never a shared overlay. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.series')}</h3>
              <ReportChartWithDrillList drill={drills.series ?? null} placeholderLabel={t('outreach.series')}
                chart={<ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />} />
            </section>

            {/* Top-20 call lists + 'others' (the exact complement, a real row);
                an archived campaign keeps its name and drills on its uuid. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.axes.campaign')}</h3>
              <ReportChartWithDrillList drill={drills.campaign ?? null} placeholderLabel={t('outreach.axes.campaign')}
                chart={bars('campaign', data.by_campaign)} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.assignee')}</h3>
              <ReportChartWithDrillList drill={drills.assignee ?? null} placeholderLabel={t('tasks.axes.assignee')}
                chart={assigneeBars(data.by_assignee)} />
            </section>

            {/* Channel axis, zero-filled over the tenant channels + 'none'. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.axes.channel')}</h3>
              <ReportChartWithDrillList drill={drills.channel ?? null} placeholderLabel={t('outreach.axes.channel')}
                chart={bars('channel', data.by_channel)} />
            </section>

            {/* Status axis — the fase-1 breakdown, now summing to total with
                value/label pairs ("Onbekend" orphan bars included). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.status')}</h3>
              <ReportChartWithDrillList drill={drills.status ?? null} placeholderLabel={t('customers.axes.status')}
                chart={bars('status', data.by_status)} />
            </section>

            {/* Outcome axis — incl. the "Geen uitkomst" sentinel so it sums to total. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.axes.outcome')}</h3>
              <ReportChartWithDrillList drill={drills.outcome ?? null} placeholderLabel={t('outreach.axes.outcome')}
                chart={bars('outcome', data.by_outcome)} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
