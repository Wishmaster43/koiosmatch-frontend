/**
 * SmCandidatesInsightsRow — the 9-slot KPI/insights row for the ShiftManager
 * candidates table (§3A blueprint: config-driven donuts[] + kpis[], equal
 * footprint, click-to-filter). One status donut + 8 KPI cards, computed from
 * the FULL candidate set (server-wide, independent of the table's page) so the
 * counts never change when the user pages through the table.
 *
 * Renders through the shared `components/insights/InsightsRow` — the same
 * component the native candidates page uses — so this strip has the identical
 * look/footprint, not a per-page reimplementation (CustomersInsightsRow is a
 * flagged near-duplicate of that shared component; this file avoids adding a
 * third copy).
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import InsightsRow from '@/components/insights/InsightsRow'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import { calcAandacht } from '@/components/reports/candidateAttention'
import { useLocale } from '@/lib/datetime'
import { SM_CANDIDATE_STATUS_COLORS, SM_CANDIDATE_STATUS_KEYS } from './data/smCandidateStatus'
import { endDateOf, noShowCountOf, cancellationsOf } from './data/smCandidateFields'
import type { ReportCandidate } from '@/types/reports'

// Recharts hands the clicked segment back at top level or nested under `.payload`.
const pickKey = (d: unknown): string | undefined => {
  const x = d as { key?: string; payload?: { key?: string }; name?: string }
  return x?.key ?? x?.payload?.key ?? x?.name
}

// New-registrations this month vs. the historical monthly average (same calc as
// the original CandidatesKpiRow, so the "new" metric keeps its exact meaning).
function calcMonthStats(candidates: ReportCandidate[]) {
  const now = new Date(); const month = now.getMonth(); const year = now.getFullYear()
  const items = candidates.filter(c => {
    if (!c.registration_date) return false
    const d = new Date(c.registration_date)
    return d.getMonth() === month && d.getFullYear() === year
  })
  const grouped: Record<string, number> = {}
  candidates.forEach(c => {
    if (!c.registration_date) return
    const d = new Date(c.registration_date)
    if (d.getMonth() === month && d.getFullYear() === year) return
    const key = `${d.getFullYear()}-${d.getMonth()}`
    grouped[key] = (grouped[key] || 0) + 1
  })
  const values = Object.values(grouped)
  const avg = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0
  return { items, avg }
}

// Candidates whose employment ends within the next 30 days — a heads-up before the
// deployability status goes stale; shares the field with the table's Uitschrijfdatum column.
function calcEndingSoon(candidates: ReportCandidate[]) {
  const now = Date.now(); const in30d = now + 30 * 86400000
  return candidates.filter(c => {
    const raw = endDateOf(c)
    if (!raw) return false
    const t = new Date(raw).getTime()
    return !isNaN(t) && t >= now && t <= in30d
  })
}

interface SmCandidatesInsightsRowProps {
  candidates: ReportCandidate[]
  // Controlled single-value status filter (array for parity with the native page's picker).
  statusFilter: Array<string | number>
  onStatusPick: (status: string) => void
  onStatusClear: () => void
  onDrillDown: (title: string, items: ReportCandidate[]) => void
}

export default function SmCandidatesInsightsRow({
  candidates, statusFilter, onStatusPick, onStatusClear, onDrillDown,
}: SmCandidatesInsightsRowProps) {
  const { t } = useTranslation(['shiftmanager', 'reports', 'common'])
  const locale = useLocale()
  const pickedStatus = statusFilter.length === 1 ? String(statusFilter[0]).toLowerCase() : null

  // Status distribution — one donut; segments filter the table (§3A click-to-filter).
  const statusData = useMemo(() => SM_CANDIDATE_STATUS_KEYS
    .map(key => ({
      key, name: t(`candidates.status.${key}`, { ns: 'reports' }),
      value: candidates.filter(c => (c.status || 'onbekend').toLowerCase() === key).length,
      color: SM_CANDIDATE_STATUS_COLORS[key],
    }))
    .filter(d => d.value > 0)
  , [candidates, t])

  const donuts: DonutSpec[] = [{
    key: 'status', title: t('candidates.cols.status', { ns: 'reports' }), data: statusData,
    onPick: d => { const k = pickKey(d); if (k) onStatusPick(k) },
    // Never highlight the donut card itself — the picked status' own KPI card
    // already carries the active border (Danny 24-07: "niet beide oranje").
    active: false,
    onClear: onStatusClear,
    picked: pickedStatus ? t(`candidates.status.${pickedStatus}`, { ns: 'reports' }) : null,
  }]

  // Existing report metrics (kept, same predicates as CandidatesKpiRow) plus two
  // data-derived additions (no-shows, cancellations) and one tied to the new
  // Uitschrijfdatum column (ending soon) to fill the shared 9-card footprint.
  const aandacht      = useMemo(() => calcAandacht(candidates), [candidates])
  const activeTotal   = useMemo(() => candidates.filter(c => (c.status || '').toLowerCase() === 'actief').length, [candidates])
  const plannedActive = useMemo(() => candidates.filter(c => {
    if ((c.status || '').toLowerCase() !== 'actief') return false
    return c.last_planned_shift && new Date(c.last_planned_shift) > new Date()
  }).length, [candidates])
  const inactiveTotal = useMemo(() => candidates.filter(c => (c.status || '').toLowerCase() === 'nietactief').length, [candidates])
  const intakeTotal   = useMemo(() => candidates.filter(c => (c.status || '').toLowerCase() === 'intake').length, [candidates])
  const monthStats    = useMemo(() => calcMonthStats(candidates), [candidates])
  const noShows       = useMemo(() => candidates.filter(c => noShowCountOf(c) > 0), [candidates])
  const cancellations = useMemo(() => candidates.filter(c => cancellationsOf(c) > 0), [candidates])
  const endingSoon    = useMemo(() => calcEndingSoon(candidates), [candidates])
  // Locale-aware month name (app locale, not a hardcoded 'nl-NL' — §5).
  const monthLabel = new Date().toLocaleString(locale, { month: 'long' })

  const kpis: KpiSpec[] = [
    { key: 'active', label: t('kpiRow.active', { ns: 'reports' }), value: activeTotal,
      sub: t('kpiRow.activeNote', { ns: 'reports', planned: plannedActive, total: activeTotal }),
      color: 'var(--color-success)', onClick: () => onStatusPick('actief'), active: pickedStatus === 'actief' },
    { key: 'inactive', label: t('kpiRow.inactive', { ns: 'reports' }), value: inactiveTotal,
      color: 'var(--color-warning)', onClick: () => onStatusPick('nietactief'), active: pickedStatus === 'nietactief' },
    { key: 'intake', label: t('kpiRow.intake', { ns: 'reports' }), value: intakeTotal,
      color: 'var(--color-violet)', onClick: () => onStatusPick('intake'), active: pickedStatus === 'intake' },
    { key: 'attention', label: t('kpiRow.attention', { ns: 'reports' }), value: aandacht.length,
      sub: t('kpiRow.attentionNote', { ns: 'reports' }), color: 'var(--color-danger)',
      onClick: () => onDrillDown(t('kpiRow.attention', { ns: 'reports' }), aandacht) },
    { key: 'newThisMonth', label: t('kpiRow.newThisMonth', { ns: 'reports', month: monthLabel, avg: monthStats.avg }),
      value: monthStats.items.length, color: 'var(--color-primary)',
      onClick: () => onDrillDown(t('kpiRow.drillNewIn', { ns: 'reports', month: monthLabel }), monthStats.items) },
    { key: 'noShows', label: t('candidatesPage.kpi.noShows'), value: noShows.length,
      sub: t('candidatesPage.kpi.noShowsSub'), color: 'var(--color-danger)',
      onClick: () => onDrillDown(t('candidatesPage.kpi.noShows'), noShows) },
    { key: 'cancellations', label: t('candidatesPage.kpi.cancellations'), value: cancellations.length,
      sub: t('candidatesPage.kpi.cancellationsSub'), color: 'var(--color-warning)',
      onClick: () => onDrillDown(t('candidatesPage.kpi.cancellations'), cancellations) },
    { key: 'endingSoon', label: t('candidatesPage.kpi.endingSoon'), value: endingSoon.length,
      sub: t('candidatesPage.kpi.endingSoonSub'), color: 'var(--color-info)',
      onClick: () => onDrillDown(t('candidatesPage.kpi.endingSoon'), endingSoon) },
  ]

  return <InsightsRow donuts={donuts} kpis={kpis} clearTitle={t('clear', { ns: 'common' })} />
}
