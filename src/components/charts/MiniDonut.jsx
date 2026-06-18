/**
 * MiniDonut — a compact donut for dashboard strips: just the ring with the total
 * in the centre. No inline legend (keeps it small); segment detail shows on hover
 * via the tooltip. Clicking a segment calls onItemClick with the data point.
 *
 * data: Array<{ name, value, key?, color? }>
 */
import { PieChart, Pie, Cell, Tooltip } from 'recharts'

const DEFAULT_COLORS = [
  'var(--color-primary)', '#10B981', '#3B8FD4', 'var(--color-warning)',
  'var(--color-danger)', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899',
]

function MiniTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct  = total ? Math.round((item.value / total) * 100) : 0
  return (
    <div style={{ padding: '5px 9px', fontSize: 11, background: 'white', borderRadius: 8,
      border: '1px solid #F3F4F6', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 600, color: '#374151' }}>{item.name}</span>
      <span style={{ color: item.payload.fill, marginLeft: 6 }}>{item.value} · {pct}%</span>
    </div>
  )
}

export default function MiniDonut({ data = [], colors = DEFAULT_COLORS, size = 56, onItemClick }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const innerR = Math.round(size * 0.34)
  const outerR = Math.round(size * 0.5)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <PieChart width={size} height={size}>
        <Pie data={data} cx="50%" cy="50%" innerRadius={innerR} outerRadius={outerR}
          paddingAngle={data.length > 1 ? 2 : 0} dataKey="value"
          cursor={onItemClick ? 'pointer' : 'default'}
          onClick={(d) => onItemClick && onItemClick(d)} stroke="none">
          {data.map((d, i) => (
            <Cell key={i} fill={d.color || colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<MiniTooltip total={total} />} />
      </PieChart>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{total}</span>
      </div>
    </div>
  )
}
