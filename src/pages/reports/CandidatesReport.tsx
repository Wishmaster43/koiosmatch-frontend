/**
 * CandidatesReport — candidates/leads INFLOW report (GET /reports/candidates,
 * RAPPORTEN-SUITE-1). Danny's morning first-look: a created_at-windowed view of who
 * came in, broken down over the five axes (status · phase · source · owner · branch)
 * as calm hand-rolled bars (no Recharts, §3B) plus a week/day timeseries. The window
 * is rendered PROMINENTLY (from/to from the envelope) — this report is windowed on
 * created_at while the candidates LIST is not, so an invisible window reads as a bug
 * report ("counts don't match the list") instead of the deliberate report/list split.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import ReportDrillDrawer from './ReportDrillDrawer'
import type { DrillSpec } from './ReportDrillDrawer'
import { useCandidatesReport } from './useCandidatesReport'
import { gateDrillClick } from './reportDrillGate'
import { useDateFormat } from '@/lib/datetime'
import type { ReportPeriod, CandidateSegment, CandidateOwnerSegment, CandidateTimeseriesPoint } from '@/types/analytics'

const card:  CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }
const state: CSSProperties = { textAlign: 'center', padding: 40, fontSize: 13 }
const head:  CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }

// The five drillable axes; `param` is the XOR query key the drill/advice endpoints expect.
type Axis = 'status' | 'phase' | 'source' | 'owner' | 'branch'

// One calm horizontal bar row: label, proportional bar (tinted in the segment's own
// lookup colour, §4 soft-chip convention — never a hardcoded hex), and the count.
function SegmentBars({ items, max, onPick }: {
  items: { key: string; label: string; count: number; color: string | null }[]
  max: number
  onPick?: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
      {items.map((it) => {
        const tint = it.color ?? 'var(--color-primary)'
        const clickable = !!onPick
        return (
          <div key={it.key}
               onClick={clickable ? () => onPick(it.key) : undefined}
               role={clickable ? 'button' : undefined}
               tabIndex={clickable ? 0 : undefined}
               onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(it.key) } } : undefined}
               style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: clickable ? 'pointer' : 'default' }}>
            <span style={{ flex: '0 0 34%', fontSize: 12, color: 'var(--text)', overflow: 'hidden',
                           textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ flex: 1, height: 8, background: 'var(--hover-bg)', borderRadius: 999, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${max > 0 ? (it.count / max) * 100 : 0}%`,
                             background: `color-mix(in srgb, ${tint} 70%, transparent)`, borderRadius: 999 }} />
            </span>
            <span style={{ flex: '0 0 40px', textAlign: 'right', fontSize: 12, fontWeight: 600,
                           fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>{it.count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function CandidatesReport({ period, tabsSlot }: { period: ReportPeriod; tabsSlot?: ReactNode }) {
  const { t } = useTranslation('analytics')
  const { formatDate } = useDateFormat()
  const { data, loading, error } = useCandidatesReport(period)

  const total   = data?.total ?? 0
  const hasData = !loading && !error && total > 0

  // Drill-down: any axis-segment bar or timeseries bucket explains itself (breakdown +
  // the candidates behind it + Koios advice). Exactly one XOR param per open drill.
  const [drill, setDrill] = useState<DrillSpec | null>(null)
  const openSegment = (seg: { label: string; count: number }, xorParam: Record<string, unknown>) => setDrill({
    title: seg.label, value: seg.count, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    rowsEndpoint: '/reports/candidates/drill', rowsParams: { ...xorParam, period },
    adviceEndpoint: '/reports/candidates/advice', adviceParams: { ...xorParam, period },
  })
  const openBucket = (pt: CandidateTimeseriesPoint) => setDrill({
    title: pt.label, value: pt.value, subtitle: `${formatDate(data?.from)} – ${formatDate(data?.to)}`,
    // A week bar's `date` is the point's own key; the drawer then counts the WHOLE
    // week (bucket=week) so bar and drawer total always agree.
    rowsEndpoint: '/reports/candidates/drill',
    rowsParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
    adviceEndpoint: '/reports/candidates/advice',
    adviceParams: { date: pt.date, ...(data?.timeseries.bucket === 'week' ? { bucket: 'week' } : {}), period },
  })

  const bars = (axis: Axis, segs: CandidateSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.value === value)
      if (seg) openSegment(seg, { [axis]: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.value, label: s.label, count: s.count, color: s.color }))} />
  }

  const ownerBars = (segs: CandidateOwnerSegment[]) => {
    const max = segs.reduce((m, s) => Math.max(m, s.count), 0)
    const onPick = gateDrillClick('candidates', (value: string) => {
      const seg = segs.find(s => s.owner_id === value)
      if (seg) openSegment({ label: seg.name, count: seg.count }, { owner: value })
    })
    return <SegmentBars max={max} onPick={onPick}
      items={segs.map(s => ({ key: s.owner_id, label: s.name, count: s.count, color: null }))} />
  }

  const seriesMax = (data?.timeseries.series ?? []).reduce((m, p) => Math.max(m, p.value), 0)
  const onSeriesPick = gateDrillClick('candidates', (dateKey: string) => {
    const pt = data?.timeseries.series.find(p => p.date === dateKey)
    if (pt) openBucket(pt)
  })

  const kpis: KpiSpec[] = [{ key: 'total', label: t('candidates.total'), value: total }]

  return (
    <div>
      {/* KPI strip — total inflow, above the tabs (candidate-page order) */}
      {hasData && (
        <div style={{ ...card, marginBottom: 16 }}>
          <InsightsRow kpis={kpis} padding="14px 20px" />
        </div>
      )}

      {/* Tab bar + period control (from the hub) */}
      {tabsSlot}

      {/* The report's data window, rendered prominently — DD-MM-YYYY (never ISO, §3B).
          A window that is invisible in the UI reads as a "report ≠ list" support ticket. */}
      {!loading && !error && data && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          {t('candidates.window', { from: formatDate(data.from), to: formatDate(data.to) })}
        </div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('candidates.loading')}</div>}
        {error && !loading && <div style={{ ...state, color: 'var(--color-danger)' }}>{t('candidates.error')}</div>}
        {!loading && !error && total === 0 && <div style={{ ...state, color: 'var(--text-muted)' }}>{t('candidates.empty')}</div>}
        {hasData && data && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Inflow over time — week/day timeseries, bucket set server-side. */}
            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.series')}</h3>
              <SegmentBars max={seriesMax} onPick={onSeriesPick}
                items={data.timeseries.series.map(p => ({ key: p.date, label: p.label, count: p.value, color: null }))} />
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.status')}</h3>
              {bars('status', data.by_status)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.phase')}</h3>
              {bars('phase', data.by_phase)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.source')}</h3>
              {bars('source', data.by_source)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.owner')}</h3>
              {ownerBars(data.by_owner)}
            </section>

            <section>
              <h3 style={{ ...head, marginBottom: 10 }}>{t('candidates.axes.branch')}</h3>
              {bars('branch', data.by_branch)}
            </section>
          </div>
        )}
      </div>

      {/* Dynamic drill-down: explains the clicked segment/bucket + Koios AI advice */}
      <ReportDrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
