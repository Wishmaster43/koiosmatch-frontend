/**
 * CandidatesKpiRow — the row of KPI cards above the candidates report
 * (active / inactive / new / needs-attention counts + a trend).
 * count() tallies candidates by status; calcAandacht() flags ones needing attention.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, UserCheck, UserX, UserPlus, TrendingUp } from 'lucide-react'
import KpiCard from '../ui/KpiCard'
import { calcAandacht } from './candidateAttention'
import type { ReportCandidate } from '@/types/reports'

// Count candidates whose status matches the given value (defaults missing to 'onbekend').
const count = (candidates: ReportCandidate[], status: string) =>
  candidates.filter(c => (c.status || 'onbekend').toLowerCase() === status).length


function calcGepland(candidates: ReportCandidate[]) {
  return candidates.filter(c => {
    if ((c.status || '').toLowerCase() !== 'actief') return false
    return c.last_planned_shift && new Date(c.last_planned_shift) > new Date()
  })
}

function calcMonthStats(candidates: ReportCandidate[]) {
  const now          = new Date()
  const currentMonth = now.getMonth()
  const currentYear  = now.getFullYear()

  const currentMonthCount = candidates.filter(c => {
    if (!c.registration_date) return false
    const d = new Date(c.registration_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  const grouped: Record<string, number> = {}
  candidates.forEach(c => {
    if (!c.registration_date) return
    const d   = new Date(c.registration_date)
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) return
    const key = `${d.getFullYear()}-${d.getMonth()}`
    grouped[key] = (grouped[key] || 0) + 1
  })
  const values = Object.values(grouped)
  const avg    = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0
  const delta  = avg > 0 ? Math.round(((currentMonthCount - avg) / avg) * 100) : 0
  return { currentMonthCount, avg, delta }
}

export default function CandidatesKpiRow({ candidates = [], loading = false, onDrillDown, onStatusFilter }: {
  candidates?: ReportCandidate[]; loading?: boolean
  onDrillDown?: (label: string, items: ReportCandidate[]) => void
  // When set, the single-status cards (active/inactive/intake) filter the table
  // in place instead of opening a drill-down (the candidates-table page).
  onStatusFilter?: (status: string) => void
}) {
  const { t } = useTranslation('reports')
  const drill = (label: string, filterFn: (c: ReportCandidate[]) => ReportCandidate[]) => {
    if (!onDrillDown) return undefined
    return () => onDrillDown(label, filterFn(candidates))
  }
  // A single-status card either filters the table (onStatusFilter) or drills down.
  const statusClick = (status: string, label: string) =>
    onStatusFilter
      ? () => onStatusFilter(status)
      : drill(label, c => c.filter(x => (x.status || '').toLowerCase() === status))

  const aandachtItems  = calcAandacht(candidates)
  const actiefTotal    = count(candidates, 'actief')
  const geplandItems   = calcGepland(candidates)
  const { currentMonthCount, avg, delta } = calcMonthStats(candidates)
  const currentMonthLabel = new Date().toLocaleString('nl-NL', { month: 'long' })

  return (
    <div className="grid gap-4 mb-6"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>

      {/* Candidates needing attention: active + new (<30d) + not planned */}
      <KpiCard
        label={t('kpiRow.attention')}
        note={t('kpiRow.attentionNote')}
        value={aandachtItems.length}
        icon={AlertTriangle}
        iconBg="var(--color-warning-bg)"
        iconColor="var(--color-warning)"
        loading={loading}
        onClick={drill(t('kpiRow.attention'), calcAandacht)}
      />

      {/* Active candidates + how many planned */}
      <KpiCard
        label={t('kpiRow.active')}
        note={t('kpiRow.activeNote', { planned: geplandItems.length, total: actiefTotal })}
        value={actiefTotal}
        icon={UserCheck}
        iconBg="var(--color-success-bg)"
        iconColor="var(--color-success)"
        loading={loading}
        onClick={statusClick('actief', t('kpiRow.drillActive'))}
      />

      {/* Inactive */}
      <KpiCard
        label={t('kpiRow.inactive')}
        value={count(candidates, 'nietactief')}
        icon={UserX}
        iconBg="var(--color-warning-bg)"
        iconColor="#C2410C"
        loading={loading}
        onClick={statusClick('nietactief', t('kpiRow.drillInactive'))}
      />

      {/* Intake */}
      <KpiCard
        label={t('kpiRow.intake')}
        value={count(candidates, 'intake')}
        icon={UserPlus}
        iconBg="#FAF5FF"
        iconColor="#7C3AED"
        loading={loading}
        onClick={statusClick('intake', t('kpiRow.drillIntake'))}
      />

      {/* New this month vs average */}
      <KpiCard
        label={t('kpiRow.newThisMonth', { month: currentMonthLabel, avg })}
        value={currentMonthCount}
        delta={delta}
        icon={TrendingUp}
        iconBg="#F0F7FF"
        iconColor="#3B8FD4"
        loading={loading}
        onClick={drill(t('kpiRow.drillNewIn', { month: currentMonthLabel }), c => c.filter(x => {
          if (!x.registration_date) return false
          const d = new Date(x.registration_date)
          return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear()
        }))}
      />
    </div>
  )
}