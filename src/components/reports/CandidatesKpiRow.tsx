/**
 * CandidatesKpiRow — the row of KPI cards above the candidates report
 * (active / inactive / new / needs-attention counts + a trend).
 * count() tallies candidates by status; calcAttention() flags ones needing attention.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, UserCheck, UserX, UserPlus, TrendingUp } from 'lucide-react'
import KpiCard from '../ui/KpiCard'
import { calcAttention } from './candidateAttention'
import { SM_STATUS, statusOf } from '@/lib/smStatus'
import type { ReportCandidate } from '@/types/reports'
// App-wide active locale (DATUM-1/LANE-B) — feeds the "new this month" month name.
import { useLocale } from '@/lib/datetime'
import { formatMonthYear } from '@/lib/localDate'

import { smRegistrationAverage } from '@/lib/smReporting'

// Count candidates whose status matches the given value, via the shared normalisation.
const count = (candidates: ReportCandidate[], status: string) =>
  candidates.filter(c => statusOf(c) === status).length


// Active candidates with a planned shift still in the future.
function calcGepland(candidates: ReportCandidate[]) {
  return candidates.filter(c => {
    if (statusOf(c) !== SM_STATUS.ACTIVE) return false
    return c.last_planned_shift && new Date(c.last_planned_shift) > new Date()
  })
}

// Renders the KPI card row above the candidates report.
export default function CandidatesKpiRow({ candidates = [], loading = false, onDrillDown, onStatusFilter }: {
  candidates?: ReportCandidate[]; loading?: boolean
  onDrillDown?: (label: string, items: ReportCandidate[]) => void
  // When set, the single-status cards (active/inactive/intake) filter the table
  // in place instead of opening a drill-down (the candidates-table page).
  onStatusFilter?: (status: string) => void
}) {
  const { t } = useTranslation('reports')
  const locale = useLocale()
  const drill = (label: string, filterFn: (c: ReportCandidate[]) => ReportCandidate[]) => {
    if (!onDrillDown) return undefined
    return () => onDrillDown(label, filterFn(candidates))
  }
  // A single-status card either filters the table (onStatusFilter) or drills down.
  const statusClick = (status: string, label: string) =>
    onStatusFilter
      ? () => onStatusFilter(status)
      : drill(label, c => c.filter(x => statusOf(x) === status))

  const aandachtItems  = calcAttention(candidates)
  const actiefTotal    = count(candidates, SM_STATUS.ACTIVE)
  const geplandItems   = calcGepland(candidates)
  const now = new Date()
  const { currentMonthCount, avg, delta } = smRegistrationAverage(candidates, now.getMonth(), now.getFullYear())
  const currentMonthLabel = formatMonthYear(now, locale, 'long')

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
        onClick={drill(t('kpiRow.attention'), calcAttention)}
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
        onClick={statusClick(SM_STATUS.ACTIVE, t('kpiRow.drillActive'))}
      />

      {/* Inactive */}
      <KpiCard
        label={t('kpiRow.inactive')}
        value={count(candidates, SM_STATUS.INACTIVE)}
        icon={UserX}
        iconBg="var(--color-warning-bg)"
        iconColor="var(--color-danger)"
        loading={loading}
        onClick={statusClick(SM_STATUS.INACTIVE, t('kpiRow.drillInactive'))}
      />

      {/* Intake */}
      <KpiCard
        label={t('kpiRow.intake')}
        value={count(candidates, SM_STATUS.INTAKE)}
        icon={UserPlus}
        iconBg="var(--color-violet-bg)"
        iconColor="var(--color-violet)"
        loading={loading}
        onClick={statusClick(SM_STATUS.INTAKE, t('kpiRow.drillIntake'))}
      />

      {/* New this month vs average */}
      <KpiCard
        label={t('kpiRow.newThisMonth', { month: currentMonthLabel, avg })}
        value={currentMonthCount}
        delta={delta}
        icon={TrendingUp}
        iconBg="var(--color-primary-bg)"
        iconColor="var(--color-primary)"
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