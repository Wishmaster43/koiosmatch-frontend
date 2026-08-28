/**
 * WeeklyBarChartCard — grouped bar chart for N series per period (e.g. weekly
 * candidates · applications · matches = the funnel). Config-driven series, theme-
 * token colours, legend, and a multi-series tooltip. Click a bar → onBarClick(row, series).
 */
import type { ReactNode } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ChartDatum, TipProps } from './chartTypes'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useNumberFormat } from '@/lib/formatters'

// A series is a grouped bar by default; `line: true` overlays it as a line (e.g. a net trend).
// `axis: 'right'` plots the series on a second Y axis (RIGHT-AXIS-1): a rate
// (0..100 %) next to count bars must never share the count scale, or a 40 %
// conversion reads as "40 prospects". `rightAxisUnit` labels that axis.
export interface BarSeries { key: string; label: string; color: string; line?: boolean; axis?: 'left' | 'right' }

// Tooltip listing every series' value for the hovered bucket. `formatNumber` is
// passed in (the tooltip is a plain function, not a component, so it can't call
// the useNumberFormat hook itself).
function MultiTooltip({ active, payload, label, formatNumber, rightKeys, rightAxisUnit }: TipProps & { formatNumber: (v: number) => string; rightKeys: Set<string>; rightAxisUnit: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ padding: '8px 11px', fontSize: 12, background: 'var(--surface)', borderRadius: 10,
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)', minWidth: 130 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{label}</div>
      {payload.map(p => (
        <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-muted)' }}>{p.name}</span>
          <strong style={{ color: 'var(--text)' }}>{formatNumber(p.value ?? 0)}{rightKeys.has(String(p.dataKey)) ? rightAxisUnit : ''}</strong>
        </div>
      ))}
    </div>
  )
}

// Config-driven grouped bar chart (see the module doc above); `axis` is set per series so a rate column never silently shares the count scale, while `stacked` is one card-level switch applied to every bar series alike.
export default function WeeklyBarChartCard({ title, data = [], series = [], height = 240, onBarClick, stacked = false, rightAxisUnit = '' }: {
  title?: ReactNode; data?: ChartDatum[]; series?: BarSeries[]; height?: number; onBarClick?: (row: unknown, series: BarSeries) => void
  // Stack every bar series onto one column instead of grouping them side-by-side.
  // Line series are untouched (a line has no stack). Default false = byte-identical
  // output to before this prop existed.
  stacked?: boolean; rightAxisUnit?: string
}) {
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  // Series on the right axis (RIGHT-AXIS-1) — rendered only when one asks for it.
  const rightKeys = new Set(series.filter(s => s.axis === 'right').map(s => s.key))
  const hasRight = rightKeys.size > 0
  if (!data.length || !series.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>
        <div className="flex items-center justify-center text-xs" style={{ height, color: 'var(--text-muted)' }}>—</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="mb-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>
      <ErrorBoundary compact>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false}
            tickFormatter={v => formatNumber(Number(v))} />
          {hasRight && (
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
              allowDecimals={false} domain={rightAxisUnit === '%' ? [0, 100] : undefined}
              tickFormatter={v => `${formatNumber(Number(v))}${rightAxisUnit}`} />
          )}
          <Tooltip content={<MultiTooltip formatNumber={formatNumber} rightKeys={rightKeys} rightAxisUnit={rightAxisUnit} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
          {series.map(s => s.line ? (
            <Line key={s.key} yAxisId={s.axis === 'right' ? 'right' : 'left'} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
          ) : (
            <Bar key={s.key} yAxisId={s.axis === 'right' ? 'right' : 'left'} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]}
              isAnimationActive={false}
              stackId={stacked ? 'stack' : undefined}
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={onBarClick ? (row: unknown) => onBarClick(row, s) : undefined} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      </ErrorBoundary>
    </div>
  )
}
