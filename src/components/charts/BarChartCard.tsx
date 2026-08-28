/** BarChartCard — themed bar chart with optional average line + click-through. */
import type { ReactNode } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useTranslation } from 'react-i18next'
import { Caption } from '@/components/ui/typography'
import type { ChartDatum, TipProps } from './chartTypes'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useNumberFormat } from '@/lib/formatters'

// `formatNumber` is passed in (the tooltip is a plain function, not a component,
// so it can't call the useNumberFormat hook itself).
function BarTooltip({ active, payload, label, total, showPercent, percentValues, formatNumber }: TipProps & { total?: number; showPercent?: boolean; percentValues?: boolean; formatNumber: (v: number) => string }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value ?? 0
  const pct   = total ? ((value / total) * 100).toFixed(1) : '0'
  return (
    <div className="px-3 py-2 text-sm rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-float)' }}>
      <div className="mb-0.5 font-medium" style={{ fontSize: 12, color: 'var(--text)' }}>{label}</div>
      <div style={{ color: payload[0].fill, fontSize: 13, fontWeight: 500 }}>
        {percentValues ? `${formatNumber(value)}%` : showPercent ? `${pct}%` : formatNumber(value)}
      </div>
    </div>
  )
}

// House bar chart card. percentValues renders values already expressed as a
// server percentage (0..100) as-is; showPercent instead computes each bar's own share of the total (EENHEID-LES, §14).
export default function BarChartCard({ title, data = [], colors = [], showPercent = false, percentValues = false, height = 220, onBarClick, showAverage = false }: {
  title?: ReactNode; data?: ChartDatum[]; colors?: string[]; showPercent?: boolean; height?: number; onBarClick?: (d: ChartDatum) => void; showAverage?: boolean
  // PERCENT-VALUES-1: the values ARE already percentages (0..100, e.g. a fill
  // rate per branch) — plot them as-is on a % axis, never re-expressed as a
  // share of the sum (that is what `showPercent` means, for raw counts). The
  // footer then states the average instead of a meaningless "total of rates".
  percentValues?: boolean
}) {
  const { t } = useTranslation('common')
  // Locale-aware grouping (§ FMT-GETAL-1) — never a hardcoded 'nl-NL' toLocaleString.
  const { formatNumber } = useNumberFormat()
  const rawTotal   = data.reduce((s, d) => s + d.value, 0)
  const rawAverage = data.length ? (percentValues ? +(rawTotal / data.length).toFixed(1) : Math.round(rawTotal / data.length)) : 0

  // With percentages: bars show as % of total; recompute the average too.
  // Percent VALUES stay untouched: the axis/tooltip only add the % sign.
  const asPercent = showPercent || percentValues
  const displayData = showPercent && !percentValues && rawTotal > 0
    ? data.map(d => ({ ...d, value: +((d.value / rawTotal) * 100).toFixed(1) }))
    : data
  const displayAverage = showPercent && !percentValues && rawTotal > 0
    ? +((rawAverage / rawTotal) * 100).toFixed(1)
    : rawAverage

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>
        <div className="flex items-center justify-center h-40 text-xs" style={{ color: 'var(--text-muted)' }}>{t('noData')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        {/* Average reads as part of the title — "Titel — gem. 7" — instead of a tiny
            dashed legend next to it (Danny 2026-07-06). */}
        <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {title}
          {showAverage && displayAverage > 0 && (
            <span> — {t('avg')} {asPercent ? displayAverage : formatNumber(displayAverage)}{asPercent ? '%' : ''}</span>
          )}
        </div>
        {onBarClick && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('clickBar')}</span>}
      </div>

      <ErrorBoundary compact>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={displayData} margin={{ top: 4, right: showAverage ? 50 : 8, left: -20, bottom: 60 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            angle={-35} textAnchor="end" interval={0} />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            allowDecimals={asPercent}
            tickFormatter={v => asPercent ? `${v}%` : formatNumber(Number(v))}
            domain={asPercent ? [0, 100] : undefined}
          />
          <Tooltip content={<BarTooltip total={rawTotal} showPercent={showPercent && !percentValues} percentValues={percentValues} formatNumber={formatNumber} />} />

          {showAverage && displayAverage > 0 && (
            <ReferenceLine
              y={displayAverage}
              stroke="var(--color-primary)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `${asPercent ? displayAverage : formatNumber(displayAverage)}${asPercent ? '%' : ''}`, position: 'right', fontSize: 10, fill: 'var(--color-primary)' }}
            />
          )}

          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(_: unknown, idx: number) => onBarClick?.(data[idx])}
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length] || 'var(--color-primary)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Keyboard path for the SVG bars (§6): hidden until focused, one real
          button per bar, firing the exact same click payload. */}
      {onBarClick && (
        <div>
          {data.map(d => (
            <button key={d.key ?? d.name} type="button"
              className="sr-only focus:not-sr-only"
              onClick={() => onBarClick(d)}>
              {d.name}: {formatNumber(d.value)}{percentValues ? '%' : ''}
            </button>
          ))}
        </div>
      )}
      </ErrorBoundary>

      {/* Footer: the sum for counts; for percent VALUES a sum is meaningless, so
          the average of the plotted rates is stated instead. */}
      <div className="flex justify-center mt-2">
        <Caption as="span">
          {percentValues
            ? <>{t('avg')}: <strong style={{ color: 'var(--text)' }}>{formatNumber(rawAverage)}%</strong></>
            : <>{t('total')}: <strong style={{ color: 'var(--text)' }}>{formatNumber(rawTotal)}</strong></>}
        </Caption>
      </div>
    </div>
  )
}
