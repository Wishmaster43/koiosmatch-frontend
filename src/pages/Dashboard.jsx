import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, CalendarDays, TrendingUp, MessageCircle, Percent } from 'lucide-react'
import api from '../lib/api'
import MonthlyKpiCard    from '../components/ui/MonthlyKpiCard'
import StatCard          from '../components/ui/StatCard'
import ShiftsChartsBlock from '../components/reports/ShiftsChartsBlock'

const RUNS = [
  { name: 'Diensten Aanbod — Yesway', time: '08:00', ok: true,  n: 87  },
  { name: 'No Response Checker',      time: '09:00', ok: true,  n: 12  },
  { name: 'Shift Reminder',           time: '10:00', ok: false, err: 'API timeout' },
  { name: 'Wekelijkse Rapportage',    time: '07:00', ok: true,  n: 441 },
]

const DUMMY_STATS = [
  { label: 'Openstaande diensten', value: '23',    sub: '5 urgent',          color: '#E11D48', bg: '#FFF1F2', icon: CalendarDays  },
  { label: 'Bezettingsgraad',      value: '87%',   sub: '+4% vorige maand',  color: '#059669', bg: '#ECFDF5', icon: Percent       },
  { label: 'Berichten verstuurd',  value: '1.847', sub: 'Deze maand',        color: '#2563EB', bg: '#EFF6FF', icon: MessageCircle },
  { label: 'Response rate',        value: '76%',   sub: 'gem. 72% historisch', color: '#D97706', bg: '#FFFBEB', icon: TrendingUp  },
]

export default function Dashboard() {
  const [candidates, setCandidates] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    api.get('/candidates?per_page=500')
      .then(res => {
        const body = res.data
        setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6">
      {/* Titel */}
      <div className="mb-5">
        <h2 className="font-semibold text-gray-900" style={{ fontSize: 18 }}>Dashboard</h2>
        <p className="text-sm text-gray-400 mt-0.5">Overzicht van vandaag</p>
      </div>

      {/* KPI rij — 5 blokjes */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <MonthlyKpiCard candidates={candidates} loading={loading} />
        {DUMMY_STATS.map(s => <StatCard key={s.label} {...s} />)}
      </div>


 {/* Twee charts met gedeelde filters */}
      <ShiftsChartsBlock />

{/* Recente uitvoeringen */}
<div className="mt-6 mb-6 overflow-hidden bg-white rounded-xl" style={{ border: '1px solid #F3F4F6' }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <span className="font-medium text-gray-900" style={{ fontSize: 13 }}>Recente uitvoeringen</span>
          <span className="text-xs text-gray-400 cursor-pointer">Alles →</span>
        </div>
        {RUNS.map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < RUNS.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
            <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
              style={{ width: 28, height: 28, background: r.ok ? '#EAF3DE' : '#FCEBEB' }}>
              {r.ok
                ? <CheckCircle size={13} color="#3B6D11" />
                : <AlertCircle size={13} color="#A32D2D" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-800 truncate" style={{ fontSize: 13 }}>{r.name}</div>
              <div className="text-xs text-gray-400">{r.ok ? `${r.n} kandidaten` : r.err}</div>
            </div>
            <span className="flex-shrink-0 text-xs text-gray-400">{r.time}</span>
          </div>
        ))}
      </div>

     
    </div>
  )
}