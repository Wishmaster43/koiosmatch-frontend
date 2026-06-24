import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, CalendarDays, TrendingUp, MessageCircle, Percent } from 'lucide-react'
import api, { unwrapList } from '../../lib/api'
import { USE_MOCKS, isAbortError } from '../../lib/mocks'
import { useKpiSettings } from '../../lib/useKpiSettings'
import { useAuth } from '../../context/AuthContext'
import MonthlyKpiCard    from '../../components/ui/MonthlyKpiCard'
import StatCard          from '../../components/ui/StatCard'
import ShiftsChartsBlock from '../../components/shiftmanager/ShiftsChartsBlock'

// Packages that unlock the AI/Workflow runs + conversations panels.
const AI_PACKAGES = ['reporting_sm_ai', 'reporting_hf_ai', 'reporting_sm_hf_ai', 'ats_crm_ai', 'ats_crm_ai_planning', 'ats_crm_aiagents', 'ats_crm_workflows', 'connect']

// ── Mock fallbacks (only rendered under USE_MOCKS, never in production) ────────
const MOCK_STAT_VALUES = { open_hours: '1.123', hours_this_month: '1.374', occupancy: '87%', messages_sent: '1.847', response_rate: '76%' }
const MOCK_RUNS = [
  { name: 'Diensten Aanbod — Yesway', time: '08:00', ok: true,  n: 87  },
  { name: 'No Response Checker',      time: '09:00', ok: true,  n: 12  },
  { name: 'Shift Reminder',           time: '10:00', ok: false, err: 'API timeout' },
  { name: 'Wekelijkse Rapportage',    time: '07:00', ok: true,  n: 441 },
]
const MOCK_CONVERSATIONS = [
  { name: 'Jan de Vries', msg: 'Ik kan morgen om 09:00 starten',  time: '08:45' },
  { name: 'Sofia Ahmed',  msg: 'Is de planning aangepast?',        time: '08:30' },
  { name: 'Mark Jansen',  msg: 'Bedankt voor de update!',          time: '07:58' },
  { name: 'Lisa Wong',    msg: 'Ik ben beschikbaar volgende week', time: '07:40' },
]

// Locale-aware HH:MM from an ISO timestamp.
const hhmm = iso => iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''
const fmt  = v => v == null ? '—' : (typeof v === 'number' ? v.toLocaleString('nl-NL') : v)

export default function ShiftmanagerDashboard() {
  const { t } = useTranslation('shiftmanager')
  const { candidates_per_page } = useKpiSettings()
  const auth = useAuth()
  const pkg  = auth?.activeTenant?.package ?? auth?.user?.tenant?.package ?? ''
  const hasAI = AI_PACKAGES.includes(pkg)

  const [candidates,    setCandidates]    = useState([])
  const [loading,       setLoading]       = useState(true)
  const [stats,         setStats]         = useState(null)
  const [runs,          setRuns]          = useState(USE_MOCKS ? MOCK_RUNS : [])
  const [conversations, setConversations] = useState(USE_MOCKS ? MOCK_CONVERSATIONS : [])

  // Candidates feed the (real) "new this month" KPI card.
  useEffect(() => {
    const ctrl = new AbortController()
    api.get(`/sm_candidates?per_page=${candidates_per_page}`, { signal: ctrl.signal })
      .then(res => { const body = res.data; setCandidates(Array.isArray(body) ? body : (body?.data ?? [])) })
      .catch(err => { if (!isAbortError(err)) setCandidates([]) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [candidates_per_page])

  // Shift KPIs from the ShiftManager report endpoint (mock values only under USE_MOCKS).
  useEffect(() => {
    const ctrl = new AbortController()
    api.get('/sm_reports/dashboard', { signal: ctrl.signal })
      .then(res => setStats(res.data ?? null))
      .catch(err => { if (!isAbortError(err)) setStats(null) })
    return () => ctrl.abort()
  }, [])

  // Recent workflow runs + WhatsApp conversations — only for AI/Workflow packages.
  useEffect(() => {
    if (!hasAI) return
    const ctrl = new AbortController()
    api.get('/workflow-runs', { params: { per_page: 5 }, signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList(res)
        const mapped = rows.map(r => ({ name: r.name, ok: (r.status ?? 'ok') === 'ok', n: r.processed_count, err: r.error, time: hhmm(r.started_at) }))
        if (mapped.length) setRuns(mapped); else if (!USE_MOCKS) setRuns([])
      })
      .catch(err => { if (!isAbortError(err) && !USE_MOCKS) setRuns([]) })
    api.get('/whatsapp/messages', { params: { per_page: 4 }, signal: ctrl.signal })
      .then(res => {
        const { rows } = unwrapList(res)
        const mapped = rows.map(m => ({
          name: `${m.candidate?.first_name ?? ''} ${m.candidate?.last_name ?? ''}`.trim() || '—',
          msg:  m.body ?? '', time: hhmm(m.sent_at),
        }))
        if (mapped.length) setConversations(mapped); else if (!USE_MOCKS) setConversations([])
      })
      .catch(err => { if (!isAbortError(err) && !USE_MOCKS) setConversations([]) })
    return () => ctrl.abort()
  }, [hasAI])

  // KPI cards — translated labels; values from the report (or mock under USE_MOCKS).
  const v = (key, mockKey) => USE_MOCKS ? MOCK_STAT_VALUES[mockKey] : fmt(stats?.[key])
  const statCards = [
    { key: 'open_hours',       label: t('dashboard.stats.openHours'),      value: v('open_hours', 'open_hours'),           sub: USE_MOCKS ? t('dashboard.statSub.urgent',    { n: 5 })      : null, color: 'var(--color-danger)',    bg: 'var(--color-danger-bg)',    icon: CalendarDays },
    { key: 'hours_this_month', label: t('dashboard.stats.hoursThisMonth'), value: v('hours_this_month', 'hours_this_month'), sub: USE_MOCKS ? t('dashboard.statSub.prevMonth', { pct: '-12%' }) : null, color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)',   icon: TrendingUp },
    { key: 'occupancy_pct',    label: t('dashboard.stats.occupancy'),      value: USE_MOCKS ? MOCK_STAT_VALUES.occupancy : (stats?.occupancy_pct != null ? `${stats.occupancy_pct}%` : '—'), sub: USE_MOCKS ? t('dashboard.statSub.prevMonth', { pct: '+4%' }) : null, color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: Percent },
    { key: 'messages_sent',    label: t('dashboard.stats.messagesSent'),   value: v('messages_sent', 'messages_sent'),     sub: USE_MOCKS ? t('dashboard.statSub.thisMonth')              : null, color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', icon: MessageCircle },
    { key: 'response_rate',    label: t('dashboard.stats.responseRate'),   value: USE_MOCKS ? MOCK_STAT_VALUES.response_rate : (stats?.response_rate_pct != null ? `${stats.response_rate_pct}%` : '—'), sub: USE_MOCKS ? t('dashboard.statSub.historicAvg', { pct: '72%' }) : null, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: TrendingUp },
  ]

  return (
    <div className="p-6">
      {/* KPI row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <MonthlyKpiCard candidates={candidates} loading={loading} />
        {statCards.map(s => <StatCard key={s.key} {...s} />)}
      </div>

      {/* Two charts with shared filters */}
      <ShiftsChartsBlock filterKey="shiftmanager-dashboard" />

      {/* Recent runs + conversations — only for packages with AI & Workflow */}
      {hasAI && <div className="grid grid-cols-2 gap-4 mt-6 mb-6">

        {/* Recent runs */}
        <div className="overflow-hidden bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-medium text-[var(--text)]" style={{ fontSize: 13 }}>{t('dashboard.recentRuns')}</span>
            <span className="text-xs text-[var(--text-muted)] cursor-pointer">{t('dashboard.viewAll')}</span>
          </div>
          {runs.length === 0 && (
            <div className="px-4 py-6 text-xs text-center text-[var(--text-muted)]">{t('charts.empty', { defaultValue: '—' })}</div>
          )}
          {runs.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < runs.length - 1 ? '1px solid var(--hover-bg)' : 'none' }}>
              <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
                style={{ width: 28, height: 28, background: r.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)' }}>
                {r.ok
                  ? <CheckCircle size={13} color="var(--color-success)" />
                  : <AlertCircle size={13} color="var(--color-danger)" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--text)] truncate" style={{ fontSize: 13 }}>{r.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{r.ok ? t('dashboard.candidates', { n: r.n }) : r.err}</div>
              </div>
              <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{r.time}</span>
            </div>
          ))}
        </div>

        {/* Recent conversations */}
        <div className="overflow-hidden bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-medium text-[var(--text)]" style={{ fontSize: 13 }}>{t('dashboard.recentConversations')}</span>
            <span className="text-xs text-[var(--text-muted)] cursor-pointer">{t('dashboard.viewAll')}</span>
          </div>
          {conversations.length === 0 && (
            <div className="px-4 py-6 text-xs text-center text-[var(--text-muted)]">{t('charts.empty', { defaultValue: '—' })}</div>
          )}
          {conversations.map((c, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < conversations.length - 1 ? '1px solid var(--hover-bg)' : 'none' }}>
              <div className="flex items-center justify-center flex-shrink-0 rounded-full"
                style={{ width: 28, height: 28, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', fontSize: 11 }}>
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--text)] truncate" style={{ fontSize: 13 }}>{c.name}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{c.msg}</div>
              </div>
              <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{c.time}</span>
            </div>
          ))}
        </div>

      </div>}
    </div>
  )
}
