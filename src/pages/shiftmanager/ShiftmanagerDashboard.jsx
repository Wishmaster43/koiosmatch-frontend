import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, CalendarDays, TrendingUp, MessageCircle, Percent } from 'lucide-react'
import api from '../../lib/api'
import { useKpiSettings } from '../../lib/useKpiSettings'
import { useAuth } from '../../context/AuthContext'
import MonthlyKpiCard    from '../../components/ui/MonthlyKpiCard'
import StatCard          from '../../components/ui/StatCard'
import ShiftsChartsBlock from '../../components/shiftmanager/ShiftsChartsBlock'

const AI_PACKAGES = ['reporting_sm_ai', 'reporting_hf_ai', 'reporting_sm_hf_ai', 'ats_crm_ai', 'ats_crm_ai_planning', 'ats_crm_aiagents', 'ats_crm_workflows', 'connect']

// Demo data for the runs panel (placeholder until wired to the API).
const RUNS = [
  { name: 'Diensten Aanbod — Yesway', time: '08:00', ok: true,  n: 87  },
  { name: 'No Response Checker',      time: '09:00', ok: true,  n: 12  },
  { name: 'Shift Reminder',           time: '10:00', ok: false, err: 'API timeout' },
  { name: 'Wekelijkse Rapportage',    time: '07:00', ok: true,  n: 441 },
]

export default function ShiftmanagerDashboard() {
  const { t } = useTranslation('shiftmanager')
  const { candidates_per_page } = useKpiSettings()

  // KPI cards — demo values until wired to the API; labels/subs from i18n.
  const DUMMY_STATS = [
    { label: t('dashboard.stats.openHours'),     value: '1.123', sub: t('dashboard.statSub.urgent', { n: 5 }),       color: '#E11D48', bg: 'var(--color-danger-bg)', icon: CalendarDays  },
    { label: t('dashboard.stats.hoursThisMonth'), value: '1.374', sub: t('dashboard.statSub.prevMonth', { pct: '-12%' }), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: TrendingUp },
    { label: t('dashboard.stats.occupancy'),     value: '87%',   sub: t('dashboard.statSub.prevMonth', { pct: '+4%' }),  color: '#059669', bg: '#ECFDF5', icon: Percent        },
    { label: t('dashboard.stats.messagesSent'),  value: '1.847', sub: t('dashboard.statSub.thisMonth'),                color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', icon: MessageCircle },
    { label: t('dashboard.stats.responseRate'),  value: '76%',   sub: t('dashboard.statSub.historicAvg', { pct: '72%' }), color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: TrendingUp },
  ]
  const auth = useAuth()
  const pkg  = auth?.activeTenant?.package ?? auth?.user?.tenant?.package ?? ''
  const hasAI = AI_PACKAGES.includes(pkg)
  const [candidates, setCandidates] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    api.get(`/sm-candidates?per_page=${candidates_per_page}`)
      .then(res => {
        const body = res.data
        setCandidates(Array.isArray(body) ? body : (body?.data ?? []))
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6">
      {/* KPI row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <MonthlyKpiCard candidates={candidates} loading={loading} />
        {DUMMY_STATS.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Two charts with shared filters */}
      <ShiftsChartsBlock filterKey="shiftmanager-dashboard" />

      {/* Recent runs + conversations — only for packages with AI & Workflow */}
      {hasAI && <div className="grid grid-cols-2 gap-4 mt-6 mb-6">

        {/* Recent runs */}
        <div className="overflow-hidden bg-white rounded-xl" style={{ border: '1px solid #F3F4F6' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="font-medium text-gray-900" style={{ fontSize: 13 }}>{t('dashboard.recentRuns')}</span>
            <span className="text-xs text-gray-400 cursor-pointer">{t('dashboard.viewAll')}</span>
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
                <div className="text-xs text-gray-400">{r.ok ? t('dashboard.candidates', { n: r.n }) : r.err}</div>
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400">{r.time}</span>
            </div>
          ))}
        </div>

        {/* Recent conversations */}
        <div className="overflow-hidden bg-white rounded-xl" style={{ border: '1px solid #F3F4F6' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
            <span className="font-medium text-gray-900" style={{ fontSize: 13 }}>{t('dashboard.recentConversations')}</span>
            <span className="text-xs text-gray-400 cursor-pointer">{t('dashboard.viewAll')}</span>
          </div>
          {[
            { name: 'Jan de Vries', msg: 'Ik kan morgen om 09:00 starten',  time: '08:45' },
            { name: 'Sofia Ahmed',  msg: 'Is de planning aangepast?',        time: '08:30' },
            { name: 'Mark Jansen',  msg: 'Bedankt voor de update!',          time: '07:58' },
            { name: 'Lisa Wong',    msg: 'Ik ben beschikbaar volgende week', time: '07:40' },
          ].map((c, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < 3 ? '1px solid #F9FAFB' : 'none' }}>
              <div className="flex items-center justify-center flex-shrink-0 rounded-full"
                style={{ width: 28, height: 28, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 11 }}>
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate" style={{ fontSize: 13 }}>{c.name}</div>
                <div className="text-xs text-gray-400 truncate">{c.msg}</div>
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400">{c.time}</span>
            </div>
          ))}
        </div>

      </div>}
    </div>
  )
}
