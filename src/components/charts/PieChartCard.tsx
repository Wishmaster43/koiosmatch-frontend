/** PieChartCard — themed donut chart with a legend, totals and click-through. */
import type { ReactNode } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useTranslation } from 'react-i18next'
import { CHART_SERIES_COLORS } from './chartTypes'
import type { ChartDatum, TipProps } from './chartTypes'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useNumberFormat } from '@/lib/formatters'

// The shared house series (chartTypes.ts) — moved there so report charts can
// mix tenant lookup colours with the same fallbacks (one palette, §11).
const DEFAULT_COLORS = CHART_SERIES_COLORS

// `unit` is an optional label appended to the count tooltip (e.g. "12 candidates").
// `formatNumber` is passed in (the tooltip is a plain function, not a component,
// so it can't call the useNumberFormat hook itself — see LineTooltip's `t` prop).
function ChartTooltip({ active, payload, total, showPercent, unit, formatNumber }: TipProps & { total?: number; showPercent?: boolean; unit?: string; formatNumber: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const val  = item.value ?? 0
  const pct  = total ? ((val / total) * 100).toFixed(1) : '0'
  return (
    <div className="px-4 py-3 text-sm rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="mb-1 font-medium" style={{ color: 'var(--text)' }}>{item.name}</div>
      <div style={{ color: item.payload?.fill }}>
        {showPercent ? `${pct}%` : `${formatNumber(val)}${unit ? ' ' + unit : ''}`}
      </div>
    </div>
  )
}

// Themed donut chart with a keyboard-operable legend, a tooltip, and an
// optional per-slice click-through; an inert slice (isInert) never advertises one.
export default function PieChartCard({ title, data = [], colors = DEFAULT_COLORS, showPercent = false, size = 200, onItemClick, unit, hideLegend = false, isInert }: {
  title?: ReactNode; data?: ChartDatum[]; colors?: string[]; showPercent?: boolean; size?: number; onItemClick?: (d: unknown) => void; unit?: string
  // INERT-SLICE-1: a slice that has no drill target (a synthetic 'others'
  // remainder, a null-id bucket) must not advertise one — no role/tabIndex/
  // cursor/hover on its legend row and no click delivered (§3 no fake
  // affordances). Additive: without it every row follows onItemClick as before.
  isInert?: (d: ChartDatum) => boolean
  // Drop the per-slice legend (LEGEND-DUP-1): additive and off by default, so
  // every existing caller renders byte-identically. Meant for the one case where
  // the legend would be a second copy of something already on screen — a donut
  // standing NEXT TO a table that already lists every row with the same value.
  // There the legend only eats the width the table needs, and the slice values
  // stay reachable through the tooltip.
  hideLegend?: boolean
}) {
  const { t } = useTranslation('common')
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>
        <div className="flex items-center justify-center h-40 text-xs" style={{ color: 'var(--text-muted)' }}>{t('noData')}</div>
      </div>
    )
  }

  const innerR = Math.round(size * 0.27)
  const outerR = Math.round(size * 0.47)

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>
        {onItemClick && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('clickSegment')}</span>}
      </div>

      {/* Chart on the left, legend on the right */}
      <div className="flex items-center gap-6">
        <ErrorBoundary compact>
        <div className="flex-shrink-0">
          <PieChart width={size} height={size}>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={innerR} outerRadius={outerR}
              paddingAngle={2} dataKey="value"
              cursor={onItemClick ? 'pointer' : 'default'}
              // The ring click carries the slice datum; an inert slice swallows it.
              onClick={(d: unknown) => { if (!isInert?.(d as ChartDatum)) onItemClick?.(d) }}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} stroke="var(--surface)" strokeWidth={2}
                  cursor={onItemClick && !isInert?.(data[i]) ? 'pointer' : 'default'} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} showPercent={showPercent} unit={unit} formatNumber={formatNumber} />} />
          </PieChart>
        </div>
        </ErrorBoundary>

        {/* Legend */}
        {!hideLegend && (
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          {data.map((entry, i) => {
            const pct = total ? ((entry.value / total) * 100).toFixed(1) : '0'
            // Keyboard operability (§6): a clickable legend row is a REAL control
            // — role/tabIndex/Enter+Space, mirroring the SegmentBars rows these
            // donuts replaced on the report pages (wave-2 Opus finding). An inert
            // slice (isInert) is a plain row: no control, no cursor, no click.
            const clickable = onItemClick && !isInert?.(entry)
            return (
              <div
                key={entry.name}
                className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onItemClick(entry) : undefined}
                onKeyDown={clickable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(entry) } } : undefined}
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (clickable) e.currentTarget.style.background = 'none' }}
              >
                <div className="flex items-center min-w-0 gap-2">
                  <span className="flex-shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: colors[i % colors.length] }} />
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{entry.name}</span>
                </div>
                <span className="flex-shrink-0 text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {showPercent ? `${pct}%` : formatNumber(entry.value)}
                </span>
              </div>
            )
          })}
          <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--hover-bg)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {t('total')}: <strong style={{ color: 'var(--text)' }}>{formatNumber(total)}</strong>
            </span>
          </div>
        </div>
        )}
      </div>

      {/* Without the legend the total would disappear with it, so it keeps its
          own line under the ring — a chart that shows shares and never states
          what they are shares OF is half a chart. */}
      {hideLegend && (
        <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('total')}: <strong style={{ color: 'var(--text)' }}>{formatNumber(total)}</strong>
        </div>
      )}
    </div>
  )
}
