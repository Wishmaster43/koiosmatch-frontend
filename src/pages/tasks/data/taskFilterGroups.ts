/**
 * buildTaskFilterGroups — the right-panel filter config for the tasks page
 * (status/priority/type/assignee). Pure function (§0.3 size split): state +
 * options come in, group config goes out — mirrors buildCandidateFilterGroups.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { Aggregate } from '../hooks/useTaskOptions'

type Tog = (set: Dispatch<SetStateAction<string[]>>) => (v: string) => void
interface Opt { value: string | number; label: string; count?: number }

// Aggregate donut data → filter-panel option rows (value/label/count).
const asOptions = (data: Aggregate[]): Opt[] => data.map(d => ({ value: d.key, label: d.name, count: d.value }))

interface BuildArgs {
  t: TFunction
  tog: Tog
  selectedStatus: string[]; setSelectedStatus: Dispatch<SetStateAction<string[]>>
  selectedPriority: string[]; setSelectedPriority: Dispatch<SetStateAction<string[]>>
  selectedType: string[]; setSelectedType: Dispatch<SetStateAction<string[]>>
  selectedAssignee: string[]; setSelectedAssignee: Dispatch<SetStateAction<string[]>>
  statusData: Aggregate[]; priorityData: Aggregate[]; typeData: Aggregate[]
  assigneeOptions: Opt[]
}

export function buildTaskFilterGroups({
  t, tog, selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority,
  selectedType, setSelectedType, selectedAssignee, setSelectedAssignee,
  statusData, priorityData, typeData, assigneeOptions,
}: BuildArgs) {
  return [
    { key: 'status',   label: t('insights.status'),   selected: selectedStatus,   options: asOptions(statusData),   onToggle: tog(setSelectedStatus) },
    { key: 'priority', label: t('insights.priority'), selected: selectedPriority, options: asOptions(priorityData), onToggle: tog(setSelectedPriority) },
    { key: 'type',     label: t('insights.type'),     selected: selectedType,     options: asOptions(typeData),     onToggle: tog(setSelectedType) },
    { key: 'assignee', label: t('cols.assignee'),     selected: selectedAssignee, options: assigneeOptions,         onToggle: tog(setSelectedAssignee) },
  ]
}
