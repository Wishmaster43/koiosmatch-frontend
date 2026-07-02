/**
 * WeeklyBarChartCard — grouped bar chart for N series per period (e.g. weekly
 * candidates · applications · matches = the funnel). Config-driven series, theme-
 * token colours, legend, and a multi-series tooltip. Click a bar → onBarClick(row, series).
 */
import type { ReactNode } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { ChartDatum, TipProps } from './chartTypes'
import ErrorBoundary from '../ui/ErrorBoundary'

// A series is a grouped bar by default; `line: true` overlays it as a line (e.g. a net trend).
export interface BarSeries { key: string; label: string; color: string; line?: boolean }

// Tooltip listing every series' value for the hovered bucket.
function MultiTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ padding: '8px 11px', fontSize: 12, background: 'white', borderRadius: 10,
      border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', minWidth: 130 }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{label}</div>
      {payload.map(p => (
        <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--text-muted)' }}>{p.name}</span>
          <strong style={{ color: 'var(--text)' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function WeeklyBarChartCard({ title, data = [], series = [], height = 240, onBarClick }: {
  title?: ReactNode; data?: ChartDatum[]; series?: BarSeries[]; height?: number; onBarClick?: (row: unknown, series: BarSeries) => void
}) {
  if (!data.length || !series.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center text-xs text-gray-300" style={{ height }}>—</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
      <ErrorBoundary compact>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<MultiTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="circle" iconSize={8} />
          {series.map(s => s.line ? (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} />
          ) : (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]}
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={onBarClick ? (row: unknown) => onBarClick(row, s) : undefined} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      </ErrorBoundary>
    </div>
  )
}
