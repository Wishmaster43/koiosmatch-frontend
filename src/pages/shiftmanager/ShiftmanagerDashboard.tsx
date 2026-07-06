import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useKpiSettings } from '@/lib/useKpiSettings'
import { useAuth } from '@/context/AuthContext'
import InsightsRow      from '@/components/insights/InsightsRow'
import type { KpiSpec, DonutSpec } from '@/components/insights/InsightsRow'
import KpiDrillDownDrawer from '@/components/reports/KpiDrillDownDrawer'
import type { ReportCandidate } from '@/types/reports'
import ShiftsChartsBlock from '@/components/shiftmanager/ShiftsChartsBlock'
import { useShiftmanagerDashboard } from './hooks/useShiftmanagerDashboard'

// Packages that unlock the AI/Workflow runs + conversations panels.
const AI_PACKAGES = ['reporting_sm_ai', 'reporting_hf_ai', 'reporting_sm_hf_ai', 'ats_crm_ai', 'ats_crm_ai_planning', 'ats_crm_aiagents', 'ats_crm_workflows', 'connect']

// Locale-aware display of a KPI value (nl-NL) with an em-dash fallback.
const fmt = (v?: unknown) => v == null ? '—' : (typeof v === 'number' ? v.toLocaleString('nl-NL') : String(v))

export default function ShiftmanagerDashboard() {
  const { t } = useTranslation('shiftmanager')
  const { candidates_per_page, new_candidates_target: target } = useKpiSettings()
  const auth = useAuth()
  const pkg  = auth?.activeTenant?.package ?? auth?.user?.tenant?.package ?? ''
  const hasAI = AI_PACKAGES.includes(pkg)

  // Data layer: SM candidates, shift KPIs, + (AI packages) recent runs/conversations.
  const { candidates, stats, runs, conversations } = useShiftmanagerDashboard(candidates_per_page, hasAI)

  // Candidate-derived KPIs (real data — the shift/hours stats stay graceful "—"
  // until the /sm_reports/dashboard feed lands, worklist SM-SHIFTS). Keep the actual
  // candidate lists so each tile can drill into them.
  const derived = useMemo(() => {
    const now = new Date(); const m = now.getMonth(); const y = now.getFullYear()
    const list = candidates as Array<Record<string, unknown>>
    const active = list.filter(c => String(c.status ?? 'onbekend').toLowerCase() === 'actief')
    const inMonth = (s: unknown) => { if (typeof s !== 'string' || !s) return false; const d = new Date(s); return d.getMonth() === m && d.getFullYear() === y }
    // "New" + its average are over ALL candidates (a new registration counts regardless
    // of current status) so the tile matches the drill-down's calc (was: active-only → gem 7 vs 9).
    const newList = list.filter(c => inMonth(c.registration_date))
    const grouped: Record<number, number> = {}
    list.forEach(c => { const s = c.registration_date; if (typeof s !== 'string') return; const d = new Date(s); if (d.getFullYear() !== y) return; grouped[d.getMonth()] = (grouped[d.getMonth()] || 0) + 1 })
    const vals = Object.values(grouped)
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    // Scoped to ACTIVE candidates (Danny: "nooit gewerkt alleen van de actieve").
    const nowMs           = now.getTime()
    const neverWorked     = active.filter(c => (Number(c.number_of_times_worked) || 0) === 0)
    const workedThisMonth = active.filter(c => inMonth(c.last_worked_shift))
    const planned         = active.filter(c => { const s = c.last_planned_shift; return typeof s === 'string' && new Date(s).getTime() > nowMs })
    return { newList, avg, active, neverWorked, workedThisMonth, planned, all: list }
  }, [candidates])

  // Distribution donut by function/position — ACTIVE candidates only (Danny).
  const functionDonut = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(candidates as Array<Record<string, unknown>>)
      .filter(c => String(c.status ?? '').toLowerCase() === 'actief')
      .forEach(c => {
        const p = String(c.position ?? '').trim() || t('dashboard.stats.unknownFunction')
        counts[p] = (counts[p] || 0) + 1
      })
    const sorted  = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const palette = ['#1B60A9', '#19A5CA', '#F0AB00', '#16A34A', '#DC2626', '#7C3AED', '#94A3B8']
    const data: Array<{ name: string; value: number; key: string; color: string }> =
      sorted.slice(0, 6).map(([name, value], i) => ({ name, value, key: name, color: palette[i] }))
    const rest = sorted.slice(6).reduce((s, [, v]) => s + v, 0)
    if (rest) data.push({ name: t('dashboard.stats.otherFunctions'), value: rest, key: '__rest', color: palette[6] })
    return data
  }, [candidates, t])

  // Distribution donut by status (deployability). Candidates aren't tied to one
  // customer, so a per-klant donut belongs on the shift charts, not here.
  const statusDonut = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(candidates as Array<Record<string, unknown>>).forEach(c => {
      const s = String(c.status ?? '').trim() || t('dashboard.stats.unknownFunction')
      counts[s] = (counts[s] || 0) + 1
    })
    const palette = ['#16A34A', '#F0AB00', '#DC2626', '#1B60A9', '#7C3AED', '#94A3B8', '#64748B']
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7)
      .map(([name, value], i) => ({ name, value, key: name, color: palette[i] }))
  }, [candidates, t])

  // Drill-down: a candidate KPI opens the shared drawer — 'average' shows the
  // per-month breakdown vs KPI target, other tiles list their subset.
  const [drill, setDrill] = useState<{ mode: string; title: string; candidates: ReportCandidate[] } | null>(null)
  const openDrill = (mode: string, title: string, list: Array<Record<string, unknown>>) =>
    setDrill({ mode, title, candidates: list as unknown as ReportCandidate[] })

  // KPI row — shared InsightsRow (same 96px footprint as every other entity page),
  // standardised to 9 tiles (Danny: "overal 9 stuks"); candidate tiles are click-to-drill.
  const v      = (key: string) => fmt(stats?.[key])
  const pctVal = (key: string) => stats?.[key] != null ? `${stats?.[key]}%` : '—'
  const newColor = derived.newList.length >= target ? 'var(--color-success)'
                 : derived.newList.length >= derived.avg ? 'var(--color-warning)' : 'var(--color-danger)'
  const kpis: KpiSpec[] = [
    // avg reads after the title (Danny: "gem met - achter de titel ipv zo klein").
    { key: 'new',              label: `${t('dashboard.stats.newThisMonth')} — ${t('dashboard.stats.avgOnly', { avg: derived.avg })}`, value: `${derived.newList.length}/${target}`, color: newColor, onClick: () => openDrill('average', t('monthlyKpi.averageCalc'), derived.all) },
    { key: 'workedActive',     label: t('dashboard.stats.workedActive'),   value: `${derived.workedThisMonth.length}/${derived.active.length}`, color: 'var(--color-success)',   onClick: () => openDrill('nieuw', t('dashboard.stats.active'), derived.active) },
    { key: 'planned',          label: t('dashboard.stats.planned'),        value: derived.planned.length,     color: 'var(--color-secondary)', onClick: () => openDrill('nieuw', t('dashboard.stats.planned'), derived.planned) },
    { key: 'neverWorked',      label: t('dashboard.stats.neverWorked'),    value: derived.neverWorked.length, color: 'var(--color-danger)',    onClick: () => openDrill('nieuw', t('dashboard.stats.neverWorked'), derived.neverWorked) },
    { key: 'open_hours',       label: t('dashboard.stats.openHours'),      value: v('open_hours'),       color: 'var(--color-warning)' },
    { key: 'hours_this_month', label: t('dashboard.stats.hoursThisMonth'), value: v('hours_this_month'), color: 'var(--color-warning)' },
    { key: 'occupancy_pct',    label: t('dashboard.stats.occupancy'),      value: pctVal('occupancy_pct'), color: 'var(--color-success)' },
  ]
  const donuts: DonutSpec[] = [
    { key: 'function', title: t('dashboard.charts.byFunction'), data: functionDonut, colors: functionDonut.map(d => d.color) },
    { key: 'status',   title: t('dashboard.charts.byStatus'),   data: statusDonut,   colors: statusDonut.map(d => d.color) },
  ]

  return (
    <div className="p-6">
      {/* KPI row — config-driven, equal-footprint (2 donuts + 7 tiles = 9) */}
      <InsightsRow donuts={donuts} kpis={kpis} padding="0 0 16px" />

      {/* Candidate KPI drill-down */}
      {drill && (
        <KpiDrillDownDrawer mode={drill.mode} title={drill.title} candidates={drill.candidates} onClose={() => setDrill(null)} />
      )}

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
