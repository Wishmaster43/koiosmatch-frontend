/**
 * buildTaskFilterGroups — the right-panel filter config for the tasks page
 * (status/priority/type/assignee/team/linked-entity/deadline/archived). Pure
 * function (§0.3 size split): state + options come in, group config goes out —
 * mirrors buildCandidateFilterGroups, including its category headers.
 */
import type { Dispatch, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { Aggregate } from '../hooks/useTaskOptions'
import type { DueRangeFilter } from '../hooks/useTaskFilters'

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
  selectedTeam: string[]; setSelectedTeam: Dispatch<SetStateAction<string[]>>
  selectedLinkType: string[]; setSelectedLinkType: Dispatch<SetStateAction<string[]>>
  dueRange: DueRangeFilter | null; setDueRange: (v: DueRangeFilter | null) => void
  showArchived: boolean; setShowArchived: (fn: (v: boolean) => boolean) => void
  statusData: Aggregate[]; priorityData: Aggregate[]; typeData: Aggregate[]
  assigneeOptions: Opt[]; teamOptions: Opt[]
  linkTypeOptions: { value: string; count: number }[]
}

export function buildTaskFilterGroups({
  t, tog, selectedStatus, setSelectedStatus, selectedPriority, setSelectedPriority,
  selectedType, setSelectedType, selectedAssignee, setSelectedAssignee,
  selectedTeam, setSelectedTeam, selectedLinkType, setSelectedLinkType,
  dueRange, setDueRange, showArchived, setShowArchived,
  statusData, priorityData, typeData, assigneeOptions, teamOptions, linkTypeOptions,
}: BuildArgs) {
  const catWork         = t('filters.categories.work')
  const catOrganisation = t('filters.categories.organisation')
  const catDisplay      = t('filters.categories.display')

  // Linked-entity type options: raw link `type` token labelled via the shared
  // links.* i18n keys (candidate/vacancy/customer/…) — never a second vocabulary.
  const linkTypeOpts: Opt[] = linkTypeOptions.map(o => ({
    value: o.value, label: t(`links.${o.value}`, { defaultValue: o.value }), count: o.count,
  }))

  return [
    // ── Werk: the recruiting/execution axes.
    { key: 'status',   type: 'search-select', category: catWork, label: t('insights.status'),   selected: selectedStatus,   options: asOptions(statusData),   onToggle: tog(setSelectedStatus) },
    { key: 'priority', type: 'search-select', category: catWork, label: t('insights.priority'), selected: selectedPriority, options: asOptions(priorityData), onToggle: tog(setSelectedPriority) },
    { key: 'type',     type: 'search-select', category: catWork, label: t('insights.type'),     selected: selectedType,     options: asOptions(typeData),     onToggle: tog(setSelectedType) },
    // ── Organisatie: who/where a task sits + what it's linked to.
    { key: 'assignee', type: 'search-select', category: catOrganisation, label: t('cols.assignee'), selected: selectedAssignee, options: assigneeOptions, onToggle: tog(setSelectedAssignee) },
    ...(teamOptions.length ? [{ key: 'team', type: 'search-select', category: catOrganisation, label: t('filters.team'), selected: selectedTeam, options: teamOptions, onToggle: tog(setSelectedTeam) }] : []),
    ...(linkTypeOpts.length ? [{ key: 'linkType', type: 'search-select', category: catOrganisation, label: t('filters.linkedEntity'), selected: selectedLinkType, options: linkTypeOpts, onToggle: tog(setSelectedLinkType) }] : []),
    // ── Weergave: deadline window + archived (view-scoping, not recruiting data).
    {
      key: 'dueRange', type: 'date-range', category: catDisplay, label: t('filters.deadlineRange'),
      from: dueRange?.from ?? '', to: dueRange?.to ?? '',
      onFromChange: (v: string) => setDueRange({ from: v, to: dueRange?.to ?? '' }),
      onToChange:   (v: string) => setDueRange({ from: dueRange?.from ?? '', to: v }),
    },
    { key: 'archived', type: 'checkbox', category: catDisplay, label: t('filters.archived'), selected: showArchived ? ['archived'] : [], options: [{ value: 'archived', label: t('view.archived') }], onToggle: () => setShowArchived(v => !v) },
  ]
}
