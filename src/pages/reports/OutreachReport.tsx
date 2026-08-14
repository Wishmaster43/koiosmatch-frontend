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
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useOutreachReport } from './useOutreachReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'campaign' | 'channel' | 'status' | 'outcome'

// Minimal surface the generic bar renderer needs — outreach axes carry no lookup
// colour (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number }

export default function OutreachReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useOutreachReport(period)

  const total   = data?.total ?? data?.total_targets ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // call-list targets behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
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

  const onSeriesPick = gateDrillClick('outreach', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Fase-1 KPI strip, unchanged (regression): reach_rate is null while nothing
  // was reached — placeholder, never a fabricated 0%. Display-only: the six-way
  // XOR carries no reached/rate segment (no fake affordances).
  const kpis: KpiSpec[] = [
    { key: 'total',   label: t('outreach.total'),   value: data?.total_targets ?? 0 },
    { key: 'reached', label: t('outreach.reached'), value: data?.reached ?? 0 },
    { key: 'rate',    label: t('outreach.reachRate'),
      value: data?.reach_rate != null ? `${Math.round(data.reach_rate * 100)}%` : '—' },
  ]

  return (
    <div>
      {/* KPI strip — above the tabs (candidate-page order: KPIs first) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently from the RESPONSE —
          DD-MM-YYYY (never ISO, §3B DATUM-1). */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('outreach.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('outreach.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('outreach.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('outreach.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Targets over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            {/* Top-20 call lists + 'others' (the exact complement, a real row);
                an archived campaign keeps its name and drills on its uuid. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.axes.campaign')}</h3>
              {bars('campaign', data.by_campaign)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.assignee')}</h3>
              {assigneeBars(data.by_assignee)}
            </section>

            {/* Channel axis, zero-filled over the tenant channels + 'none'. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.axes.channel')}</h3>
              {bars('channel', data.by_channel)}
            </section>

            {/* Status axis — the fase-1 breakdown, now summing to total with
                value/label pairs ("Onbekend" orphan bars included). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('customers.axes.status')}</h3>
              {bars('status', data.by_status)}
            </section>

            {/* Outcome axis — incl. the "Geen uitkomst" sentinel so it sums to total. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('outreach.axes.outcome')}</h3>
              {bars('outcome', data.by_outcome)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
