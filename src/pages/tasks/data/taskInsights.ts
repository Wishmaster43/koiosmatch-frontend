/**
 * buildTaskInsights — pure builder for the tasks page KPI strip (§3A
 * config-driven InsightsRow; §0.3 split from TasksPage). Three donuts
 * (status / priority / type, click-to-filter) + 4 KPI cards (open/overdue/
 * due-today/completed). No hooks, no state — everything arrives as arguments.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import type { Aggregate } from '../hooks/useTaskOptions'

// Donut click → set exactly one filter value (or clear when clicking it again).
const pickOne = (set: Dispatch<SetStateAction<string[]>>) => (d: unknown) => {
  const o = d as { key?: string; name?: string; payload?: { key?: string } } | null | undefined
  const v = o?.key ?? o?.payload?.key ?? o?.name
  if (v != null) set(p => (p.length === 1 && p[0] === v) ? [] : [v])
}

interface Args {
  t: TFunction
  statusData: Aggregate[]; priorityData: Aggregate[]; typeData: Aggregate[]
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedPriority: string[]; setSelectedPriority: Dispatch<SetStateAction<string[]>>
  selectedType: string[]; setSelectedType: Dispatch<SetStateAction<string[]>>
  kpiFilter: string | null; toggleKpi: (k: string) => void
  openCount: number; overdue: number; dueToday: number; completedCount: number
}

export function buildTaskInsights({
  t, statusData, priorityData, typeData,
  selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority, selectedType, setSelectedType,
  kpiFilter, toggleKpi, openCount, overdue, dueToday, completedCount,
}: Args) {
  // ── Insights strip: 3 donuts (filterable) + 4 KPI cards, equal footprint ──
  const donuts: DonutSpec[] = [
    { key: 'status',   title: t('insights.status'),   data: statusData,   onPick: pickOne(setSelectedStatus),   active: selectedStatus.length > 0,   onClear: () => setSelectedStatus([]) },
    { key: 'priority', title: t('insights.priority'), data: priorityData, onPick: pickOne(setSelectedPriority), active: selectedPriority.length > 0, onClear: () => setSelectedPriority([]) },
    { key: 'type',     title: t('insights.type'),     data: typeData,     onPick: pickOne(setSelectedType),     active: selectedType.length > 0,     onClear: () => setSelectedType([]) },
  ]
  const kpis: KpiSpec[] = [
    { key: 'open',      label: t('kpi.open'),      value: openCount,      color: 'var(--color-primary)', onClick: () => toggleKpi('open'),      active: kpiFilter === 'open' },
    { key: 'overdue',   label: t('kpi.overdue'),   value: overdue,        color: 'var(--color-danger)',  onClick: () => toggleKpi('overdue'),   active: kpiFilter === 'overdue' },
    { key: 'dueToday',  label: t('kpi.dueToday'),  value: dueToday,       color: 'var(--color-warning)', onClick: () => toggleKpi('dueToday'),  active: kpiFilter === 'dueToday' },
    { key: 'completed', label: t('kpi.completed'), value: completedCount, color: 'var(--color-success)', onClick: () => toggleKpi('completed'), active: kpiFilter === 'completed' },
  ]
  return { donuts, kpis }
}
