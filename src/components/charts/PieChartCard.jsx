import { PieChart, Pie, Cell, Tooltip } from 'recharts'

const DEFAULT_COLORS = [
  '#534AB7','#10B981','#3B8FD4','#F59E0B',
  '#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899',
]

function ChartTooltip({ active, payload, total, showPercent }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const pct  = total ? ((item.value / total) * 100).toFixed(1) : 0
  return (
    <div className="px-4 py-3 text-sm bg-white rounded-xl"
      style={{ border: '1px solid #F3F4F6', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div className="mb-1 font-medium text-gray-800">{item.name}</div>
      <div style={{ color: item.payload.fill }}>
        {showPercent ? `${pct}%` : `${item.value} kandidaten`}
      </div>
    </div>
  )
}

export default function PieChartCard({ title, data = [], colors = DEFAULT_COLORS, showPercent = false, size = 200, onItemClick }) {
  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center h-40 text-xs text-gray-300">Geen data</div>
      </div>
    )
  }

  const innerR = Math.round(size * 0.27)
  const outerR = Math.round(size * 0.47)

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {onItemClick && <span className="text-xs text-gray-300">klik op segment</span>}
      </div>

      {/* Chart links, legenda rechts */}
      <div className="flex items-center gap-6">
        <div className="flex-shrink-0">
          <PieChart width={size} height={size}>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={innerR} outerRadius={outerR}
              paddingAngle={2} dataKey="value"
              cursor={onItemClick ? 'pointer' : 'default'}
              onClick={(data) => onItemClick && onItemClick(data)}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip total={total} showPercent={showPercent} />} />
          </PieChart>
        </div>

        {/* Legenda */}
        <div className="flex flex-col flex-1 min-w-0 gap-2">
          {data.map((entry, i) => {
            const pct = total ? ((entry.value / total) * 100).toFixed(1) : 0
            return (
              <div
                key={entry.name}
                className="flex items-center justify-between gap-2 rounded px-1 py-0.5"
                onClick={() => onItemClick && onItemClick(entry)}
                style={{ cursor: onItemClick ? 'pointer' : 'default' }}
                onMouseEnter={e => onItemClick && (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => onItemClick && (e.currentTarget.style.background = 'none')}
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
          <div className="pt-2 mt-1" style={{ borderTop: '1px solid #F9FAFB' }}>
            <span className="text-xs text-gray-400">
              Totaal: <strong className="text-gray-700">{total}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}