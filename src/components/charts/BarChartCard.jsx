import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts'

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
  const total   = data.reduce((s, d) => s + d.value, 0)
  const average = data.length ? Math.round(total / data.length) : 0

  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center h-40 text-xs text-gray-300">Geen data</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-600">{title}</div>
          {showAverage && average > 0 && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#534AB7' }}>
              <div style={{ width: 16, borderTop: '2px dashed #534AB7' }} />
              gem. {average}
            </div>
          )}
        </div>
        {onBarClick && <span className="text-xs text-gray-300">klik op balk voor details</span>}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: showAverage ? 50 : 8, left: -20, bottom: 60 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }}
            angle={-35} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
          <Tooltip content={<BarTooltip total={total} showPercent={showPercent} />} />

          {showAverage && average > 0 && (
            <ReferenceLine
              y={average}
              stroke="#534AB7"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: `${average}`, position: 'right', fontSize: 10, fill: '#534AB7' }}
            />
          )}

          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(data) => onBarClick && onBarClick(data)}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length] || '#534AB7'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center mt-2">
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          Totaal: <strong style={{ color: '#374151' }}>{total}</strong>
        </span>
      </div>
    </div>
  )
}