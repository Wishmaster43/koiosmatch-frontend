import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'
import type { ChartDatum, TipProps } from './chartTypes'
import ErrorBoundary from '../ui/ErrorBoundary'

// Tooltip showing the point value + a caller-supplied unit (e.g. "candidates").
function LineTooltip({ active, payload, label, onItemClick, unit, t }: TipProps & { onItemClick?: (d: unknown) => void; unit?: string; t: TFunction }) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 text-sm bg-white rounded-xl"
      style={{ border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div className="mb-0.5 font-medium text-gray-500" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ color: 'var(--color-primary)', fontSize: 13, fontWeight: 600 }}>
        {payload[0].value}{unit ? ` ${unit}` : ''}
      </div>
      {onItemClick && <div className="mt-1 text-xs text-gray-300">{t('clickForDetails')}</div>}
    </div>
  )
}

// `unit` is the noun shown after the value in the tooltip; the caller passes it
// (the chart is generic), e.g. t('common:units.candidates').
export default function LineChartCard({ title, data = [], color = 'var(--color-primary)', height = 220, onItemClick, unit = '' }: {
  title?: ReactNode; data?: ChartDatum[]; color?: string; height?: number; onItemClick?: (d: unknown) => void; unit?: string
}) {
  const { t } = useTranslation('common')

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center text-xs text-gray-300" style={{ height }}>
          {t('noData')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {onItemClick && <span className="text-xs text-gray-300">{t('clickPoint')}</span>}
      </div>
      <ErrorBoundary compact>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<LineTooltip onItemClick={onItemClick} unit={unit} t={t} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 4, fill: color, strokeWidth: 0, cursor: onItemClick ? 'pointer' : 'default' }}
            activeDot={{
              r: 6,
              fill: color,
              cursor: onItemClick ? 'pointer' : 'default',
              onClick: (_: unknown, payload: unknown) => onItemClick?.(payload),
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      </ErrorBoundary>
    </div>
  )
}
