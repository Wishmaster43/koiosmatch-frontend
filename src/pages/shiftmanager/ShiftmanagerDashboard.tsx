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

// Loosely-typed SM candidate row (mirrors external data).
type Rec = Record<string, unknown>

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
    // Mutually-exclusive activity buckets over ACTIVE candidates (for the one
    // combined "Activiteit" donut — Danny: samenvoegen op slimme manier, uit
    // last_worked_shift / last_planned_shift / number_of_times_worked).
    const nowMs = now.getTime()
    const isFuture = (s: unknown) => typeof s === 'string' && new Date(s).getTime() > nowMs
    const bNever: Rec[] = [], bWorked: Rec[] = [], bPlanned: Rec[] = [], bIdle: Rec[] = []
    for (const c of active) {
      if ((Number(c.number_of_times_worked) || 0) === 0) bNever.push(c)
      else if (inMonth(c.last_worked_shift)) bWorked.push(c)
      else if (isFuture(c.last_planned_shift)) bPlanned.push(c)
      else bIdle.push(c)
    }
    const inactive = list.filter(c => String(c.status ?? '').toLowerCase() !== 'actief')
    return { newList, avg, active, inactive, all: list, bNever, bWorked, bPlanned, bIdle }
  }, [candidates])

  // One combined "Activiteit" donut over ACTIVE candidates (Gewerkt deze maand /
  // Ingepland / Nooit gewerkt / Geen recente activiteit) — replaces 3 separate tiles.
  const activityBuckets = useMemo(() => ([
    { key: 'worked',  label: t('dashboard.stats.workedThisMonth'), list: derived.bWorked,  color: '#16A34A' },
    { key: 'planned', label: t('dashboard.stats.planned'),         list: derived.bPlanned, color: '#1B60A9' },
    { key: 'never',   label: t('dashboard.stats.neverWorked'),     list: derived.bNever,   color: '#DC2626' },
    { key: 'idle',    label: t('dashboard.stats.idle'),            list: derived.bIdle,    color: '#94A3B8' },
  ]), [derived, t])
  const activityDonut = activityBuckets.map(b => ({ name: b.label, value: b.list.length, key: b.key, color: b.color }))

  // Drill-down: a candidate KPI/donut segment opens the shared drawer — 'average'
  // shows the per-month breakdown vs KPI target, other picks list their subset.
  const [drill, setDrill] = useState<{ mode: string; title: string; candidates: ReportCandidate[]; tabs?: { key: string; label: string; candidates: ReportCandidate[] }[]; initialTab?: string } | null>(null)
  const openDrill = (mode: string, title: string, list: Array<Record<string, unknown>>) =>
    setDrill({ mode, title, candidates: list as unknown as ReportCandidate[] })
  // A click on an activity donut segment opens the drill on that bucket, with a
  // switcher across all four buckets (Danny: "in drill down kunnen switchen").
  const activityTabs = activityBuckets.map(b => ({ key: b.key, label: b.label, candidates: b.list as unknown as ReportCandidate[] }))
  const onActivityPick = (d: unknown) => {
    const k = (d as { key?: string })?.key
    if (activityBuckets.some(x => x.key === k)) setDrill({ mode: 'nieuw', title: '', candidates: [], tabs: activityTabs, initialTab: k })
  }

  // KPI row — shared InsightsRow (same 96px footprint as every other entity page),
  // standardised to 9 tiles (Danny: "overal 9 stuks"); candidate tiles are click-to-drill.
  const v      = (key: string) => fmt(stats?.[key])
  const pctVal = (key: string) => stats?.[key] != null ? `${stats?.[key]}%` : '—'
  const newColor = derived.newList.length >= target ? 'var(--color-success)'
                 : derived.newList.length >= derived.avg ? 'var(--color-warning)' : 'var(--color-danger)'
  const kpis: KpiSpec[] = [
    // 'New' is the candidate metric; avg reads after the title (Danny: "gem met - achter de titel").
    { key: 'new',              label: `${t('dashboard.stats.newThisMonth')} — ${t('dashboard.stats.avgOnly', { avg: derived.avg })}`, value: `${derived.newList.length}/${target}`, color: newColor, onClick: () => openDrill('average', t('monthlyKpi.averageCalc'), derived.all) },
    { key: 'total',            label: t('dashboard.stats.totalCandidates'), value: derived.all.length,      color: 'var(--color-primary)', onClick: () => openDrill('nieuw', t('dashboard.stats.totalCandidates'), derived.all) },
    // Shift-hours stats — still graceful '—' until derived from the filtered shift data
    // (SM-SHIFTS feed / SM-CHARTS2 aggregation); these read from /sm_reports/dashboard.
    { key: 'open_hours',       label: t('dashboard.stats.openHours'),      value: v('open_hours'),       color: 'var(--color-warning)' },
    { key: 'hours_this_month', label: t('dashboard.stats.hoursThisMonth'), value: v('hours_this_month'), color: 'var(--color-warning)' },
    { key: 'occupancy_pct',    label: t('dashboard.stats.occupancy'),      value: pctVal('occupancy_pct'), color: 'var(--color-success)' },
    { key: 'messages_sent',    label: t('dashboard.stats.messagesSent'),   value: v('messages_sent'),    color: 'var(--color-secondary)' },
    { key: 'response_rate',    label: t('dashboard.stats.responseRate'),   value: pctVal('response_rate_pct'), color: 'var(--color-warning)' },
  ]
  // Two donuts: a candidate-based activity donut (clickable) + the per-klant shift
  // donut (customer from the order → name). The klant data comes from the backend
  // shift aggregation (SM-CHARTS2); until it lands the donut is a graceful "—" slot.
  const donuts: DonutSpec[] = [
    { key: 'activity', title: t('dashboard.charts.activity'),   data: activityDonut, colors: activityDonut.map(d => d.color), onPick: onActivityPick },
    { key: 'customer', title: t('dashboard.charts.byCustomer'), data: [] },
  ]

  return (
    <div className="p-6">
      {/* KPI row — config-driven, equal-footprint (1 activity donut + 6 tiles) */}
      <InsightsRow donuts={donuts} kpis={kpis} padding="0 0 16px" />

      {/* Candidate KPI drill-down */}
      {drill && (
        <KpiDrillDownDrawer mode={drill.mode} title={drill.title} candidates={drill.candidates} tabs={drill.tabs} initialTab={drill.initialTab} onClose={() => setDrill(null)} />
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
