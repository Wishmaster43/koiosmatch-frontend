/**
 * TasksReport — tasks report (GET /reports/tasks, RAPPORTEN-SUITE-1 "portie 6").
 * Mirrors OpportunitiesReport 1:1: same envelope family, same calm bars via the
 * shared SegmentBars, the window rendered prominently from the RESPONSE. Drill
 * XOR params follow the seven-way tasks contract: status|type|priority|assignee|
 * team|branch|date (+bucket=week next to a week bar's date). Every axis sums to
 * `total`; status/type/priority key on the LOOKUP ID (never the slug) and their
 * 'none' sentinels + orphan-uuid rows are normal, drillable bars. The KPI strip
 * is display-only: the XOR carries no open/done/overdue segment (no fake
 * affordances — a stat without a real drill path never looks clickable).
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useTasksReport } from './useTasksReport'
import { gateDrillClick } from './reportDrillGate'
import SegmentBars from './SegmentBars'
import ReportTimeseriesChart from './ReportTimeseriesChart'
import { useDateFormat } from '@/lib/datetime'
import { formatNumber } from '@/lib/formatters'
import type { ReportPeriod, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// The plain single-value XOR axes; `assignee` has its own D2 shape below.
type Axis = 'status' | 'type' | 'priority' | 'team' | 'branch'

// Minimal surface the generic bar renderer needs — status rows carry a lookup
// colour, the other axes do not (SegmentBars falls back to the primary tint).
type AxisSeg = { value: string; label: string; count: number; color?: string | null }

export default function TasksReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useTasksReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (the
  // tasks behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const windowSub = () => `${formatDate(data?.from)} – ${formatDate(data?.to)}`
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: windowSub(),
    rowsEndpoint: '/reports/tasks/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/tasks/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: windowSub(),
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/tasks/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/tasks/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  // Generic axis-bar renderer: 'none' sentinels and orphaned (deleted-lookup)
  // values are all normal array entries — each drills on its RAW value (the
  // lookup ID for status/type/priority, never a slug), exactly like any other
  // segment (no special-casing, see SegmentBars).
  const bars = (axis: Axis, segs: AxisSeg[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('tasks', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color ?? null }))} />
  }

  // Assignee axis (D2 shape: owner_id/name → the `assignee` param; a NULL
  // assignee arrives as the 'none' row, "Niet toegewezen").
  const assigneeBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('tasks', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { assignee: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const onSeriesPick = gateDrillClick('tasks', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  // Workload KPI strip from the envelope's flag-driven summary. Display-only:
  // the seven-way XOR carries no open/done/overdue param (no fake affordances) —
  // without onClick the card renders as a plain stat, never a dead button.
  // done_rate is null while nothing is countable — placeholder, never a fabricated 0%.
  const s = data?.summary
  const kpis: KpiSpec[] = [
    { key: 'total',    label: t('tasks.total'),            value: total },
    { key: 'open',     label: t('tasks.summary.open'),     value: s?.open ?? 0 },
    { key: 'done',     label: t('tasks.summary.done'),     value: s?.done ?? 0 },
    { key: 'overdue',  label: t('tasks.summary.overdue'),  value: s?.overdue ?? 0 },
    { key: 'doneRate', label: t('tasks.summary.doneRate'),
      value: s?.done_rate != null ? `${formatNumber(s.done_rate)}%` : '—' },
  ]

  return (
    <div>
      {/* KPI strip — workload health, above the tabs (candidate-page order) */}
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
          {t('tasks.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('tasks.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('tasks.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('tasks.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Created over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.series')}</h3>
              <ReportTimeseriesChart series={data.timeseries.series} onPick={onSeriesPick} />
            </section>

            {/* Status axis — ID-keyed (slug is not unique-protected); always sums
                to total ('none' folding + orphan-uuid rows included). */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.status')}</h3>
              {bars('status', data.by_status)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.type')}</h3>
              {bars('type', data.by_type)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.priority')}</h3>
              {bars('priority', data.by_priority)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.assignee')}</h3>
              {assigneeBars(data.by_assignee)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.team')}</h3>
              {bars('team', data.by_team)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('tasks.axes.branch')}</h3>
              {bars('branch', data.by_branch)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
