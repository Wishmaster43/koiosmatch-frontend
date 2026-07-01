import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, CalendarDays, TrendingUp, MessageCircle, Percent } from 'lucide-react'
import { useKpiSettings } from '@/lib/useKpiSettings'
import { useAuth } from '@/context/AuthContext'
import MonthlyKpiCard    from '@/components/ui/MonthlyKpiCard'
import StatCard          from '@/components/ui/StatCard'
import ShiftsChartsBlock from '@/components/shiftmanager/ShiftsChartsBlock'
import { useShiftmanagerDashboard } from './hooks/useShiftmanagerDashboard'

// Packages that unlock the AI/Workflow runs + conversations panels.
const AI_PACKAGES = ['reporting_sm_ai', 'reporting_hf_ai', 'reporting_sm_hf_ai', 'ats_crm_ai', 'ats_crm_ai_planning', 'ats_crm_aiagents', 'ats_crm_workflows', 'connect']

// Locale-aware display of a KPI value (nl-NL) with an em-dash fallback.
const fmt = (v?: unknown) => v == null ? '—' : (typeof v === 'number' ? v.toLocaleString('nl-NL') : String(v))

export default function ShiftmanagerDashboard() {
  const { t } = useTranslation('shiftmanager')
  const { candidates_per_page } = useKpiSettings()
  const auth = useAuth()
  const pkg  = auth?.activeTenant?.package ?? auth?.user?.tenant?.package ?? ''
  const hasAI = AI_PACKAGES.includes(pkg)

  // Data layer: SM candidates, shift KPIs, + (AI packages) recent runs/conversations.
  const { candidates, loading, stats, runs, conversations } = useShiftmanagerDashboard(candidates_per_page, hasAI)

  // KPI cards — translated labels; values from /sm_reports/dashboard (deltas TBD).
  const v = (key: string) => fmt(stats?.[key])
  const statCards = [
    { key: 'open_hours',       label: t('dashboard.stats.openHours'),      value: v('open_hours'),       sub: null, color: 'var(--color-danger)',    bg: 'var(--color-danger-bg)',    icon: CalendarDays },
    { key: 'hours_this_month', label: t('dashboard.stats.hoursThisMonth'), value: v('hours_this_month'), sub: null, color: 'var(--color-warning)',   bg: 'var(--color-warning-bg)',   icon: TrendingUp },
    { key: 'occupancy_pct',    label: t('dashboard.stats.occupancy'),      value: stats?.occupancy_pct != null ? `${stats?.occupancy_pct}%` : '—', sub: null, color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: Percent },
    { key: 'messages_sent',    label: t('dashboard.stats.messagesSent'),   value: v('messages_sent'),    sub: null, color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)', icon: MessageCircle },
    { key: 'response_rate',    label: t('dashboard.stats.responseRate'),   value: stats?.response_rate_pct != null ? `${stats?.response_rate_pct}%` : '—', sub: null, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: TrendingUp },
  ]

  return (
    <div className="p-6">
      {/* KPI row */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <MonthlyKpiCard candidates={candidates} loading={loading} />
        {statCards.map(({ key, ...s }) => <StatCard key={key} {...s} />)}
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
