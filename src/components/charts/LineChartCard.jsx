import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts'

function LineTooltip({ active, payload, label, onItemClick }) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 text-sm bg-white rounded-xl"
      style={{ border: '1px solid #F3F4F6', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <div className="mb-0.5 font-medium text-gray-500" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ color: 'var(--color-primary)', fontSize: 13, fontWeight: 600 }}>
        {payload[0].value} kandidaten
      </div>
      {onItemClick && <div className="mt-1 text-xs text-gray-300">klik voor details</div>}
    </div>
  )
}

export default function LineChartCard({ title, data = [], color = 'var(--color-primary)', height = 220, onItemClick }) {
  if (!data.length) {
    return (
      <div className="flex flex-col flex-1 min-w-0">
        <div className="mb-4 text-sm font-medium text-gray-600">{title}</div>
        <div className="flex items-center justify-center text-xs text-gray-300" style={{ height }}>
          Geen data
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        {onItemClick && <span className="text-xs text-gray-300">klik op punt</span>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<LineTooltip onItemClick={onItemClick} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4, fill: color, strokeWidth: 0, cursor: onItemClick ? 'pointer' : 'default' }}
            activeDot={{
              r: 6,
              fill: color,
              cursor: onItemClick ? 'pointer' : 'default',
              onClick: (_, payload) => onItemClick && onItemClick(payload),
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}