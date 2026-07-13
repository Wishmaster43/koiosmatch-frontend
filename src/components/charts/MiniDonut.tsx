/**
 * MiniDonut — a compact donut for dashboard strips: just the ring with the total
 * in the centre. No inline legend (keeps it small); segment detail shows on hover
 * via the tooltip. Clicking a segment calls onItemClick with the data point.
 */
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { ChartDatum, TipProps } from './chartTypes'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useLocale } from '@/lib/datetime'
import { formatNumber, formatNumberCompact } from '@/lib/formatters'

const DEFAULT_COLORS = [
  'var(--color-primary)', '#10B981', '#3B8FD4', 'var(--color-warning)',
  'var(--color-danger)', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899',
]

function MiniTooltip({ active, payload, total }: TipProps & { total?: number }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const val  = item.value ?? 0
  const pct  = total ? Math.round((val / total) * 100) : 0
  return (
    <div style={{ padding: '5px 9px', fontSize: 11, background: 'white', borderRadius: 8,
      border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
      <span style={{ color: item.payload?.fill, marginLeft: 6 }}>{val} · {pct}%</span>
    </div>
  )
}

export default function MiniDonut({ data = [], colors = DEFAULT_COLORS, size = 56, onItemClick, pickedKey = null }: {
  data?: ChartDatum[]; colors?: string[]; size?: number; onItemClick?: (d: unknown) => void
  // Active-filter value (key or label) — the other segments dim so the pick is visible.
  pickedKey?: string | null
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const innerR = Math.round(size * 0.26)
  const outerR = Math.round(size * 0.5)
  // Compact once the grouped number would overflow the ring (5-6 digit totals on
  // large tenants); the full grouped number always lives in the title tooltip.
  const locale = useLocale()
  const centerLabel = formatNumberCompact(total, locale)
  const fullLabel = formatNumber(total, locale)
  // A segment counts as picked when the filter value matches its key OR its label.
  const isPicked = (d: ChartDatum) => {
    const k = (d as { key?: string }).key
    return pickedKey != null && (k === pickedKey || d.name === pickedKey)
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <ErrorBoundary fallback={() => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>}>
      <PieChart width={size} height={size}>
        <Pie data={data} cx="50%" cy="50%" innerRadius={innerR} outerRadius={outerR}
          paddingAngle={data.length > 1 ? 2 : 0} dataKey="value"
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(d: unknown) => onItemClick?.(d)} stroke="none"
          isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || colors[i % colors.length]}
              opacity={pickedKey != null && !isPicked(d) ? 0.25 : 1} />
          ))}
        </Pie>
        <Tooltip content={<MiniTooltip total={total} />} />
      </PieChart>
      </ErrorBoundary>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', pointerEvents: 'auto' }} title={fullLabel}>
          {centerLabel}
        </span>
      </div>
    </div>
  )
}
