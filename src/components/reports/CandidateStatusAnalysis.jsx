import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw } from 'lucide-react'
import api from '../../lib/api'

const COLORS = [
  '#534AB7','#10B981','#3B8FD4','#F59E0B',
  '#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316','#EC4899',
]

const STATUS_META = {
  actief:   { label: 'Actief',   bg: '#F0FDF4', color: '#16A34A', border: '#86EFAC' },
  inactief: { label: 'Inactief', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  pending:  { label: 'Pending',  bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  onbekend: { label: 'Onbekend', bg: '#F9FAFB', color: '#6B7280', border: '#E5E7EB' },
}

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

function ChartLegend({ data, total, showPercent }) {
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((entry, i) => {
        const pct = total ? ((entry.value / total) * 100).toFixed(1) : 0
        return (
          <div key={entry.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0 gap-2">
              <span className="flex-shrink-0 rounded-full"
                style={{ width: 8, height: 8, background: COLORS[i % COLORS.length] }} />
              <span className="text-sm text-gray-600 truncate">{entry.name}</span>
            </div>
            <span className="flex-shrink-0 text-sm font-medium text-gray-800">
              {showPercent ? `${pct}%` : entry.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function StatusFilter({ status, isOn, count, onToggle }) {
  const meta = STATUS_META[status] || STATUS_META.onbekend
  return (
    <button
      onClick={() => onToggle(status)}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        background: isOn ? meta.bg    : '#F9FAFB',
        color:      isOn ? meta.color : '#9CA3AF',
        border:     `1px solid ${isOn ? meta.border : '#E5E7EB'}`,
        cursor: 'pointer',
      }}
    >
      <span className="flex-shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: isOn ? meta.color : '#D1D5DB' }} />
      {meta.label}
      {count > 0 && (
        <span className="rounded-full px-1.5 py-0.5 font-mono"
          style={{ fontSize: 10, background: isOn ? meta.color : '#E5E7EB', color: isOn ? 'white' : '#9CA3AF' }}>
          {count}
        </span>
      )}
    </button>
  )
}

export default function CandidatesAnalysis() {
  const [allCandidates,  setAllCandidates]  = useState([])
  const [activeStatuses, setActiveStatuses] = useState(['actief'])
  const [showPercent,    setShowPercent]    = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  const fetchCandidates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await api.get('/candidates?per_page=500')
      const body = res.data
      let candidates = []

      if (Array.isArray(body)) {
        candidates = body
      } else if (Array.isArray(body?.data)) {
        candidates = body.data
        if (body.last_page > 1) {
          const pages = Array.from({ length: body.last_page - 1 }, (_, i) => i + 2)
          const extra = await Promise.all(
            pages.map(p => api.get(`/candidates?per_page=500&page=${p}`).then(r => r.data?.data || []))
          )
          candidates = [...candidates, ...extra.flat()]
        }
      }

      setAllCandidates(candidates)
    } catch {
      setError('Kon kandidaten niet laden.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCandidates() }, [])

  const availableStatuses = [...new Set(
    allCandidates.map(c => (c.status || 'onbekend').toLowerCase())
  )].sort()

  const filtered = allCandidates.filter(c =>
    activeStatuses.length === 0 || activeStatuses.includes((c.status || 'onbekend').toLowerCase())
  )

  const chartData = Object.entries(
    filtered.reduce((acc, c) => {
      const fn = c.functie || c.raw_data?.employee?.function || 'Onbekend'
      acc[fn] = (acc[fn] || 0) + 1
      return acc
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const total = filtered.length

  const toggleStatus = (status) =>
    setActiveStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-semibold text-gray-900" style={{ fontSize: 16 }}>
            Kandidaten per functie
          </h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? 'Laden...' : `${total} van ${allCandidates.length} kandidaten`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(availableStatuses.length ? availableStatuses : ['actief', 'inactief']).map(status => (
              <StatusFilter
                key={status}
                status={status}
                isOn={activeStatuses.includes(status)}
                count={allCandidates.filter(c => (c.status || 'onbekend').toLowerCase() === status).length}
                onToggle={toggleStatus}
              />
            ))}
          </div>

          {/* Getallen / Percentages toggle */}
          <div className="flex rounded-lg p-0.5"
            style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
            {[{ id: false, label: 'Getallen' }, { id: true, label: 'Percentages' }].map(opt => (
              <button key={String(opt.id)} onClick={() => setShowPercent(opt.id)}
                className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: showPercent === opt.id ? 'white' : 'transparent',
                  color:      showPercent === opt.id ? '#111827' : '#6B7280',
                  border:     showPercent === opt.id ? '1px solid #E5E7EB' : '1px solid transparent',
                  cursor: 'pointer',
                  boxShadow:  showPercent === opt.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button onClick={fetchCandidates} disabled={loading}
            className="flex items-center justify-center transition-colors rounded-lg"
            style={{ width: 32, height: 32, background: '#F9FAFB', border: '1px solid #E5E7EB', cursor: 'pointer', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Fout */}
      {error && (
        <div className="px-4 py-3 mb-4 text-sm text-red-600 rounded-xl bg-red-50"
          style={{ border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Laden */}
      {loading && (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl"
          style={{ border: '1px solid #F3F4F6' }}>
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#D1D5DB' }} />
            <p className="text-sm text-gray-400">Kandidaten ophalen...</p>
          </div>
        </div>
      )}

      {/* Leeg */}
      {!loading && chartData.length === 0 && (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl"
          style={{ border: '1px solid #F3F4F6' }}>
          <div className="text-center">
            <p className="mb-1 text-sm font-medium text-gray-400">Geen kandidaten gevonden</p>
            <p className="text-xs text-gray-300">Selecteer minimaal één statusfilter</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {!loading && chartData.length > 0 && (
        <div className="p-6 bg-white rounded-xl" style={{ border: '1px solid #F3F4F6' }}>
          <div className="flex flex-col items-center gap-8 lg:flex-row">
            <div className="flex-shrink-0" style={{ width: 280, height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%"
                    innerRadius={70} outerRadius={120} paddingAngle={2} dataKey="value">
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip total={total} showPercent={showPercent} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full">
              <ChartLegend data={chartData} total={total} showPercent={showPercent} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}