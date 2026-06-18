/** BarChartCard — themed bar chart with optional average line + click-through. */
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useTranslation } from 'react-i18next'

function BarTooltip({ active, payload, label, total, showPercent }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  const pct   = total ? ((value / total) * 100).toFixed(1) : 0
  return (
    <div className="px-3 py-2 text-sm bg-white rounded-xl"
      style={{ border: '1px solid #F3F4F6', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div className="mb-0.5 font-medium text-gray-800" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ color: payload[0].fill, fontSize: 13, fontWeight: 500 }}>
        {showPercent ? `${pct}%` : value}
      </div>
    </div>
  )
}

export default function BarChartCard({ title, data = [], colors = [], showPercent = false, height = 220, onBarClick, showAverage = false }) {
  const { t } = useTranslation('common')
  const rawTotal   = data.reduce((s, d) => s + d.value, 0)
  const rawAverage = data.length ? Math.round(rawTotal / data.length) : 0

  // With percentages: bars show as % of total; recompute the average too.
  const displayData = showPercent && rawTotal > 0
    ? data.map(d => ({ ...d, value: +((d.value / rawTotal) * 100).toFixed(1) }))
    : data
  const displayAverage = showPercent && rawTotal > 0
    ? +((rawAverage / rawTotal) * 100).toFixed(1)
    : rawAverage

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center h-40 text-xs text-gray-300">{t('noData')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          {showAverage && displayAverage > 0 && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-primary)' }}>
              <div style={{ width: 16, borderTop: '2px dashed var(--color-primary)' }} />
              {t('avg')} {displayAverage}{showPercent ? '%' : ''}
            </div>
          )}
        </div>
        {onBarClick && <span className="text-xs text-gray-300">{t('clickBar')}</span>}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={displayData} margin={{ top: 4, right: showAverage ? 50 : 8, left: -20, bottom: 60 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }}
            angle={-35} textAnchor="end" interval={0} />
          <YAxis
            tick={{ fontSize: 10, fill: '#9CA3AF' }}
            allowDecimals={showPercent}
            tickFormatter={v => showPercent ? `${v}%` : v}
            domain={showPercent ? [0, 100] : undefined}
          />
          <Tooltip content={<BarTooltip total={rawTotal} showPercent={showPercent} />} />

          {showAverage && displayAverage > 0 && (
            <ReferenceLine
              y={displayAverage}
              stroke="var(--color-primary)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `${displayAverage}${showPercent ? '%' : ''}`, position: 'right', fontSize: 10, fill: 'var(--color-primary)' }}
            />
          )}

          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(_, idx) => onBarClick && onBarClick(data[idx])}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length] || 'var(--color-primary)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center mt-2">
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          {t('total')}: <strong style={{ color: '#374151' }}>{rawTotal}</strong>
        </span>
      </div>
    </div>
  )
}