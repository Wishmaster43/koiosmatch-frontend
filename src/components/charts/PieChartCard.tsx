/** PieChartCard — themed donut chart with a legend, totals and click-through. */
import type { ReactNode } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { ChartDatum, TipProps } from './chartTypes'

const DEFAULT_COLORS = [
  'var(--color-primary)','#10B981','#3B8FD4','var(--color-warning)',
  'var(--color-danger)','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899',
]

// `unit` is an optional label appended to the count tooltip (e.g. "12 candidates").
function ChartTooltip({ active, payload, total, showPercent, unit }: TipProps & { total?: number; showPercent?: boolean; unit?: string }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const val  = item.value ?? 0
  const pct  = total ? ((val / total) * 100).toFixed(1) : '0'
  return (
    <div className="px-4 py-3 text-sm bg-white rounded-xl"
      style={{ border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div className="mb-1 font-medium text-gray-800">{item.name}</div>
      <div style={{ color: item.payload?.fill }}>
        {showPercent ? `${pct}%` : `${val}${unit ? ' ' + unit : ''}`}
      </div>
    </div>
  )
}

export default function PieChartCard({ title, data = [], colors = DEFAULT_COLORS, showPercent = false, size = 200, onItemClick, unit }: {
  title?: ReactNode; data?: ChartDatum[]; colors?: string[]; showPercent?: boolean; size?: number; onItemClick?: (d: unknown) => void; unit?: string
}) {
  const { t } = useTranslation('common')
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center h-40 text-xs text-gray-300">{t('noData')}</div>
      </div>
    )
  }

  const innerR = Math.round(size * 0.27)
  const outerR = Math.round(size * 0.47)

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {onItemClick && <span className="text-xs text-gray-300">{t('clickSegment')}</span>}
      </div>

      {/* Chart on the left, legend on the right */}
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <PieChart width={size} height={size}>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={innerR} outerRadius={outerR}
              paddingAngle={2} dataKey="value"
              cursor={onItemClick ? 'pointer' : 'default'}
              onClick={(d: unknown) => onItemClick?.(d)}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} showPercent={showPercent} unit={unit} />} />
          </PieChart>
        </div>

        {/* Legend */}
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          {data.map((entry, i) => {
            const pct = total ? ((entry.value / total) * 100).toFixed(1) : '0'
            return (
              <div
                key={entry.name}
                className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
                onClick={() => onItemClick?.(entry)}
                style={{ cursor: onItemClick ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (onItemClick) e.currentTarget.style.background = 'var(--hover-bg)' }}
                onMouseLeave={e => { if (onItemClick) e.currentTarget.style.background = 'none' }}
              >
                <div className="flex items-center min-w-0 gap-2">
                  <span className="flex-shrink-0 rounded-full"
                    style={{ width: 8, height: 8, background: colors[i % colors.length] }} />
                  <span className="text-xs text-gray-600 truncate">{entry.name}</span>
                </div>
                <span className="flex-shrink-0 text-xs font-medium text-gray-800">
                  {showPercent ? `${pct}%` : entry.value}
                </span>
              </div>
            )
          })}
          <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--hover-bg)' }}>
            <span className="text-xs text-gray-400">
              {t('total')}: <strong className="text-gray-700">{total}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
