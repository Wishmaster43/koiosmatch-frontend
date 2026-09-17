/**
 * buildTaskInsights — pure builder for the tasks page KPI strip (§3A
 * config-driven InsightsRow; §0.3 split from TasksPage). KPI-RIJ-9-1 (O22):
 * four donuts (status / priority / type / assignee, click-to-filter) + 5 KPI
 * cards (open/overdue/due-today/completed/unassigned) — 9 cards total. No
 * hooks, no state — everything arrives as arguments.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { DonutSpec, KpiSpec } from '@/components/insights/InsightsRow'
import type { Aggregate } from '../hooks/useTaskOptions'
import { pickOne } from '@/lib/insightsHelpers'

interface Args {
  t: TFunction
  statusData: Aggregate[]; priorityData: Aggregate[]; typeData: Aggregate[]; assigneeData: Aggregate[]
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedPriority: string[]; setSelectedPriority: Dispatch<SetStateAction<string[]>>
  selectedType: string[]; setSelectedType: Dispatch<SetStateAction<string[]>>
  selectedAssignee: string[]; setSelectedAssignee: Dispatch<SetStateAction<string[]>>
  kpiFilter: string | null; toggleKpi: (k: string) => void
  openCount: number; overdue: number; dueToday: number; completedCount: number; unassigned: number
}

// Pure builder for the tasks KPI/insights strip (see file docblock above) —
// plain data/callbacks in, the donuts/kpis config InsightsRow renders out.
export function buildTaskInsights({
  t, statusData, priorityData, typeData, assigneeData,
  selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority, selectedType, setSelectedType,
  selectedAssignee, setSelectedAssignee,
  kpiFilter, toggleKpi, openCount, overdue, dueToday, completedCount, unassigned,
}: Args) {
  // ── Insights strip: 4 donuts (filterable) + 5 KPI cards, equal footprint (KPI-RIJ-9-1) ──
  const donuts: DonutSpec[] = [
    { key: 'status',   title: t('insights.status'),   data: statusData,   onPick: pickOne(setSelectedStatus),   active: selectedStatus.length > 0,   onClear: () => setSelectedStatus([]) },
    { key: 'priority', title: t('insights.priority'), data: priorityData, onPick: pickOne(setSelectedPriority), active: selectedPriority.length > 0, onClear: () => setSelectedPriority([]) },
    { key: 'type',     title: t('insights.type'),     data: typeData,     onPick: pickOne(setSelectedType),     active: selectedType.length > 0,     onClear: () => setSelectedType([]) },
    { key: 'assignee', title: t('insights.assignee'), data: assigneeData, onPick: pickOne(setSelectedAssignee), active: selectedAssignee.length > 0, onClear: () => setSelectedAssignee([]) },
  ]
  const kpis: KpiSpec[] = [
    { key: 'open',      label: t('kpi.open'),      value: openCount,      color: 'var(--color-primary)', onClick: () => toggleKpi('open'),      active: kpiFilter === 'open' },
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    { key: 'overdue',   label: t('kpi.overdue'),   value: overdue,        color: 'var(--color-danger)',  onClick: () => toggleKpi('overdue'),   active: kpiFilter === 'overdue' },
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    { key: 'dueToday',  label: t('kpi.dueToday'),  value: dueToday,       color: 'var(--color-warning)', onClick: () => toggleKpi('dueToday'),  active: kpiFilter === 'dueToday' },
    // eslint-disable-next-line huisstijl/no-restricted-syntax -- DATA: semantic colour VALUE for the shared chip/donut/series recipes (tinted/chipInked downstream), not text ink
    { key: 'completed', label: t('kpi.completed'), value: completedCount, color: 'var(--color-success)', onClick: () => toggleKpi('completed'), active: kpiFilter === 'completed' },
    // KPI-RIJ-9-1: 9th card. --color-info carries no ink-contrast guard (only
    // danger/success/warning do), so it needs no lint suppression here.
    { key: 'unassigned', label: t('kpi.unassigned'), value: unassigned, color: 'var(--color-info)', onClick: () => toggleKpi('unassigned'), active: kpiFilter === 'unassigned' },
  ]
  return { donuts, kpis }
}
