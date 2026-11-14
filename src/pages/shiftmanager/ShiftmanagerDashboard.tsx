// ShiftmanagerDashboard — the Shiftmanager (SM) reporting home: candidate KPIs
// (activity buckets, attention candidates) mirrored against the candidates report
// so both screens agree, plus shift/hours charts and, on AI-enabled packages, the
// recent runs/conversations panels. Every KPI opens the shared drill-down drawer.
import { useMemo, useState } from 'react'
import { SM_STATUS, statusOf } from '@/lib/smStatus'
import { useTranslation } from 'react-i18next'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { useKpiSettings } from '@/lib/useKpiSettings'
import { useAuth } from '@/context/AuthContext'
import { canAccessPage } from '@/lib/access'
import Button from '@/components/ui/Button'
import { useNumberFormat } from '@/lib/formatters'
import { SmLoadErrorBanner } from './SmLoadErrorBanner'
import type { KpiSpec } from '@/components/insights/InsightsRow'
import KpiDrillDownDrawer from '@/components/reports/KpiDrillDownDrawer'
import DrillDownDrawer from '@/components/reports/DrillDownDrawer'
import type { DrillDownTab } from '@/components/reports/DrillDownDrawer'
import { calcAttention } from '@/components/reports/candidateAttention'
import type { ReportCandidate } from '@/types/reports'
import ShiftsChartsBlock from '@/components/shiftmanager/ShiftsChartsBlock'
import { useShiftmanagerDashboard } from './hooks/useShiftmanagerDashboard'

// Packages that unlock the AI/Workflow runs + conversations panels.
const AI_PACKAGES = ['reporting_sm_ai', 'reporting_hf_ai', 'reporting_sm_hf_ai', 'ats_crm_ai', 'ats_crm_ai_planning', 'ats_crm_aiagents', 'ats_crm_workflows', 'connect']

// Loosely-typed SM candidate row (mirrors external data).
type Rec = Record<string, unknown>

// Shared card header for the recent-runs/recent-conversations panels; the "view all" link only renders when the viewer may open its target page.
function DashboardCardHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="font-medium text-(--text)" style={{ fontSize: 13 }}>{title}</span>
      {href && <Button variant="ghost" size="sm" href={href}>{linkLabel}</Button>}
    </div>
  )
}

// Shiftmanager report dashboard: KPI cards, activity buckets and drill-down popups, gated on the tenant's AI/workflow package.
export default function ShiftmanagerDashboard() {
  const { t } = useTranslation('shiftmanager')
  const { candidates_per_page, new_candidates_target: target } = useKpiSettings()
  const { formatNumber } = useNumberFormat()
  const auth = useAuth()
  const pkg  = auth?.activeTenant?.package ?? auth?.user?.tenant?.package ?? ''
  const hasAI = AI_PACKAGES.includes(pkg)

  // Data layer: SM candidates, candidate stat COUNTS, + (AI packages) recent runs/conversations.
  const { candidates, loading, error, refetch, runs, conversations, candidateStats, candidateStatsLoading, candidateStatsError } =
    useShiftmanagerDashboard(candidates_per_page, hasAI)
  const useCandidateStats = !candidateStatsLoading && !candidateStatsError && Boolean(candidateStats)

  // Candidate-derived KPIs (real data — the shift/hours stats stay graceful "—"
  // until the shift KPI feed lands, worklist SM-SHIFTS). Keep the actual
  // candidate lists so each tile can drill into them.
  const derived = useMemo(() => {
    const now = new Date(); const m = now.getMonth(); const y = now.getFullYear()
    const list = candidates as Array<Record<string, unknown>>
    const active = list.filter(c => statusOf(c) === SM_STATUS.ACTIVE)
    const inMonth = (s: unknown) => { if (typeof s !== 'string' || !s) return false; const d = new Date(s); return d.getMonth() === m && d.getFullYear() === y }
    // "New" + its average are over ALL candidates (a new registration counts regardless
    // of current status) so the tile matches the drill-down's calc (was: active-only → gem 7 vs 9).
    // The ITEMS list still needs rows (feeds the tile's drill-down); the displayed AVG
    // (a plain COUNT-derived mean) prefers the server's registrations_per_month below
    // (SM-STATS-2) so it is never undercounted by the `candidates_per_page` row cap.
    const newList = list.filter(c => inMonth(c.registration_date))
    const grouped: Record<number, number> = {}
    list.forEach(c => { const s = c.registration_date; if (typeof s !== 'string') return; const d = new Date(s); if (d.getFullYear() !== y) return; grouped[d.getMonth()] = (grouped[d.getMonth()] || 0) + 1 })
    const vals = Object.values(grouped)
    const rowAvg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    // Displayed COUNT and AVG must describe the same population (§ same-population
    // rule) — both prefer the server's registrations_per_month when it is available,
    // never mixing a stats avg with a row-capped count or vice versa.
    const thisMonthBucket = useCandidateStats && candidateStats
      ? candidateStats.registrations_per_month.find(mb => mb.month - 1 === m)
      : undefined
    const avg = useCandidateStats && candidateStats
      ? (() => {
          const others = candidateStats.registrations_per_month.filter(mb => mb.month - 1 !== m).map(mb => mb.total)
          return others.length ? Math.round(others.reduce((a, b) => a + b, 0) / others.length) : 0
        })()
      : rowAvg
    const newCount = thisMonthBucket ? thisMonthBucket.total : newList.length
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
    const inactive = list.filter(c => statusOf(c) === SM_STATUS.INACTIVE)
    // Aandachtskandidaten ("attention candidates") — the SAME function as the candidates
    // report (calcAttention: active + new <30d + not yet scheduled) so the KPIs on both
    // screens match (Danny). calcAttention already includes the never-logged-in clause and the
    // server attention.count (SM-STATS-3) implements the same rule; the 2 "works less" rules wait on hours.
    const attention = calcAttention(list as unknown as ReportCandidate[])
    return { newList, newCount, avg, active, inactive, all: list, bNever, bWorked, bPlanned, bIdle, attention }
  }, [candidates, useCandidateStats, candidateStats])

  // Tile counts read the whole-mirror stats blocks (SM-STATS-3) when present; the lists stay the
  // capped rows and carry the server total into the drawer. Absent block or gate closed: row fallback.
  const act = useCandidateStats ? candidateStats?.activity : undefined
  const attn = useCandidateStats ? candidateStats?.attention : undefined
  // One combined "Activity" donut over ACTIVE candidates (Worked this month /
  // Planned / Never worked / No recent activity) — replaces 3 separate tiles.
  const activityBuckets = useMemo(() => ([
    { key: 'worked',  label: t('dashboard.stats.workedThisMonth'), title: t('dashboard.stats.workedThisMonthHint'), list: derived.bWorked,  total: act?.worked_this_month, color: 'var(--color-success-text)' },
    { key: 'planned', label: t('dashboard.stats.planned'),         title: t('dashboard.stats.plannedHint'),         list: derived.bPlanned, total: act?.planned, color: 'var(--color-secondary)' },
    { key: 'never',   label: t('dashboard.stats.neverWorked'),     title: t('dashboard.stats.neverWorkedHint'),     list: derived.bNever,   total: act?.never_worked, color: 'var(--color-danger-text)' },
    { key: 'idle',    label: t('dashboard.stats.idle'),            title: t('dashboard.stats.idleHint'),            list: derived.bIdle,    total: act?.idle, color: 'var(--text-muted)' },
  ]), [derived, t, act])
  // Drill-down: a candidate KPI opens the shared drawer — 'average' shows the per-month
  // breakdown vs KPI target, other picks list their subset.
  const [drill, setDrill] = useState<{ mode: string; title: string; candidates: ReportCandidate[]; tabs?: DrillDownTab[]; initialTab?: string; total?: number } | null>(null)
  const openDrill = (mode: string, title: string, list: Array<Record<string, unknown>>, total?: number) =>
    setDrill({ mode, title, candidates: list as unknown as ReportCandidate[], total })
  // The Activiteit card opens the drill with a tab per bucket (Danny: "kunnen switchen"),
  // starting on the biggest bucket.
  const activityTabs = activityBuckets.map(b => ({ key: b.key, label: b.label, title: b.title, candidates: b.list as unknown as ReportCandidate[], total: b.total }))
  // Open the drill-down defaulted to whichever activity bucket currently has the most candidates.
  const openActivityDrill = () => {
    const biggest = [...activityBuckets].sort((a, b) => (b.total ?? b.list.length) - (a.total ?? a.list.length))[0]
    setDrill({ mode: 'new', title: '', candidates: [], tabs: activityTabs, initialTab: biggest?.key })
  }
  // Aandachtskandidaten drill: the "nieuw & niet ingepland" list (X/actief).
  const openAttentionDrill = () => openDrill('new', t('dashboard.stats.attnNewNotPlanned'), derived.attention, attn?.count)

  // Candidate cards (NOT filter-driven) — passed into ShiftsChartsBlock, which adds the
  // filter-driven shift cards → one combined 9-card row. Activiteit is a clearer channels
  // card (big total + a coloured count per bucket) instead of a cramped 54px donut (Danny).
  const newColor = derived.newCount >= target ? 'var(--color-success)'
                 : derived.newCount >= derived.avg ? 'var(--color-warning)' : 'var(--color-danger)'
  // Only the two candidate cards on the dashboard; ShiftsChartsBlock adds the seven
  // shift cards → one 9-card row. (Totaal/Inactief eruit — Danny: "ruk".)
  const pair = (a: number, b: number) => `${formatNumber(a)}/${formatNumber(b)}`
  // While the candidate rows load or failed the tiles show an empty value (never a misleading 0/0) and are not clickable.
  const tilesReady = !loading && !error
  const leadingKpis: KpiSpec[] = [
    { key: 'activity',  label: t('dashboard.stats.workedActive'), value: tilesReady ? pair(act?.worked_this_month ?? derived.bWorked.length, act?.active ?? derived.active.length) : null, color: 'var(--color-success-text)', onClick: tilesReady ? openActivityDrill : undefined },
    { key: 'new',       label: t('dashboard.stats.newThisMonthAvg', { avg: formatNumber(derived.avg) }), value: tilesReady ? pair(derived.newCount, target) : null, color: newColor, onClick: tilesReady ? () => openDrill('average', t('monthlyKpi.averageCalc'), derived.all) : undefined },
    { key: 'attention', label: t('dashboard.stats.attentionCandidates'), value: tilesReady ? pair(attn?.count ?? derived.attention.length, act?.active ?? derived.active.length) : null, color: (attn?.count ?? derived.attention.length) > 0 ? 'var(--color-danger)' : 'var(--color-success)', onClick: tilesReady ? openAttentionDrill : undefined },
  ]

  return (
    <div className="p-6">
      {/* Candidate KPI drill-down — 'average' keeps the per-month breakdown drawer;
          every list drill uses the rich DrillDownDrawer (full candidate cards) + tabs. */}
      {drill && (drill.mode === 'average'
        ? <KpiDrillDownDrawer mode="average" title={drill.title} candidates={drill.candidates} onClose={() => setDrill(null)} />
        : <DrillDownDrawer title={drill.title} candidates={drill.candidates} tabs={drill.tabs} initialTab={drill.initialTab} total={drill.total} onClose={() => setDrill(null)} />
      )}

      <SmLoadErrorBanner isError={error} onRetry={refetch} />

      {/* Combined KPI row + charts — ShiftsChartsBlock owns the row so the shift cards follow the applied filter */}
      <ShiftsChartsBlock filterKey="shiftmanager-dashboard" leadingKpis={leadingKpis} />

      {/* Recent runs + conversations — only for packages with AI & Workflow */}
      {hasAI && <div className="grid grid-cols-2 gap-4 mt-6 mb-6">

        {/* Recent runs */}
        <div className="overflow-hidden bg-(--surface) rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <DashboardCardHeader title={t('dashboard.recentRuns')} linkLabel={t('dashboard.viewAll')}
            href={canAccessPage('details.runs', auth ?? undefined) ? '#details.runs' : undefined} />
          {runs.length === 0 && (
            <div className="px-4 py-6 text-xs text-center text-(--text-muted)">{t('charts.empty')}</div>
          )}
          {runs.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: i < runs.length - 1 ? '1px solid var(--hover-bg)' : 'none' }}>
              <div className="flex items-center justify-center shrink-0 rounded-lg"
                style={{ width: 28, height: 28, background: r.ok === true ? 'var(--color-success-bg)' : r.ok === false ? 'var(--color-danger-bg)' : 'var(--hover-bg)' }}>
                {r.ok === true
                  ? <CheckCircle size={13} color="var(--color-success)" />
                  : r.ok === false
                  ? <AlertCircle size={13} color="var(--color-danger)" />
                  : <Clock size={13} color="var(--text-muted)" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-(--text) truncate" style={{ fontSize: 13 }}>{r.name}</div>
                <div className="text-xs text-(--text-muted)">{r.ok === true ? t('dashboard.candidates', { n: r.n }) : r.ok === false ? (r.err ?? t('dashboard.runFailed')) : t('dashboard.runInProgress')}</div>
              </div>
              <span className="shrink-0 text-xs text-(--text-muted)">{r.time}</span>
            </div>
          ))}
        </div>

        {/* Recent conversations */}
        <div className="overflow-hidden bg-(--surface) rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <DashboardCardHeader title={t('dashboard.recentConversations')} linkLabel={t('dashboard.viewAll')}
            href={canAccessPage('details.messages', auth ?? undefined) ? '#details.messages' : undefined} />
          {conversations.length === 0 && (
            <div className="px-4 py-6 text-xs text-center text-(--text-muted)">{t('charts.empty')}</div>
          )}
          {conversations.map((c, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < conversations.length - 1 ? '1px solid var(--hover-bg)' : 'none' }}>
              <div className="flex items-center justify-center shrink-0 rounded-full"
                style={{ width: 28, height: 28, background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)', fontSize: 11 }}>
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-(--text) truncate" style={{ fontSize: 13 }}>{c.name}</div>
                <div className="text-xs text-(--text-muted) truncate">{c.msg}</div>
              </div>
              <span className="shrink-0 text-xs text-(--text-muted)">{c.time}</span>
            </div>
          ))}
        </div>

      </div>}
    </div>
  )
}
