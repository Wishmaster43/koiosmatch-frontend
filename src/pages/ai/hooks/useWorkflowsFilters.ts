/**
 * List-view state for the workflows page: grid/list view mode (persisted,
 * non-PII), the right-panel status/module filters registered via
 * RightPanelContext, and the final visible-list derivation (folder + archived +
 * status + module). Extracted from WorkflowsPage to keep the page a thin
 * container (§3A); depends on `workflows`/`showArchived`/`selectedFolder` which
 * live in useWorkflowsData.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useRightPanel } from '@/context/RightPanelContext'
import type { Workflow } from '@/types/workflow'
import type { FolderId } from './useWorkflowsData'

// Non-PII UI preference (which view the list opens in) — survives reloads (AW-list).
const VIEW_MODE_KEY = 'wf.viewMode'
export type ViewMode = 'grid' | 'list'
const readStoredViewMode = (): ViewMode => (localStorage.getItem(VIEW_MODE_KEY) === 'grid' ? 'grid' : 'list')

// View mode + right-panel filters + the resulting visible workflow list.
// `showTrash` (TRASH-OVERAL-2) narrows to lifecycle pending_erase; exclusive with showArchived.
export function useWorkflowsFilters(workflows: Workflow[], showArchived: boolean, selectedFolder: FolderId, showTrash: boolean = false) {
  const { t } = useTranslation(['workflows', 'common'])
  // List is the Make.com-style default; the choice persists across reloads (localStorage, non-PII).
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode)
  // Sets the view mode and persists the choice to localStorage so it survives a reload.
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  // Right-panel filters (status + module type) — registering them shows the topbar
  // filter button, just like the candidates/planning pages.
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  // Distinct workflow statuses present, with live counts, for the status filter options.
  const statusOptions = useMemo(() => [...new Set(workflows.map(w => w.status))].filter((v): v is string => Boolean(v))
    .map(v => ({ value: v, label: t(`status.${v}`, { defaultValue: v }), count: workflows.filter(w => w.status === v).length })), [workflows, t])
  // Counts how many workflows use each step/module type, across all workflows' steps, for the module-type filter options.
  const moduleOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    workflows.forEach(w => new Set((w.steps ?? []).map(s => s.type).filter((x): x is string => Boolean(x))).forEach(ty => { counts[ty] = (counts[ty] ?? 0) + 1 }))
    return Object.keys(counts).map(v => ({ value: v, label: t(`modules.${v}`, { defaultValue: v }), count: counts[v] }))
  }, [workflows, t])

  // Builds the status/module filter definitions handed to the shared right-panel filter UI.
  const filterGroups = useMemo(() => [
    { key: 'status', label: t('filters.status'), selected: selectedStatus, options: statusOptions,
      onToggle: (v: string) => setSelectedStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'module', label: t('filters.module'), selected: selectedModule, options: moduleOptions,
      onToggle: (v: string) => setSelectedModule(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedStatus, selectedModule, statusOptions, moduleOptions])

  // Registers this page's filter groups with the shared right panel, and unregisters them on unmount so they do not leak into another page.
  useEffect(() => {
    registerFilters('workflows-page', filterGroups)
    return () => unregisterFilters('workflows-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const visibleWorkflows = workflows.filter(wf => {
    // Three lifecycle views (TRASH-OVERAL-2, mirrors candidates): trash =
    // pending_erase only, archived = archived only, default = active only.
    const lc = wf.lifecycle ?? (wf.archived ? 'archived' : 'active')
    if (showTrash ? lc !== 'pending_erase' : showArchived ? lc !== 'archived' : wf.archived) return false
    // Folder filter (left list)
    if (selectedFolder === 'unassigned' && wf.folder_id) return false
    if (selectedFolder && selectedFolder !== 'unassigned' && wf.folder_id !== selectedFolder) return false
    // Right-panel filters
    if (selectedStatus.length && !selectedStatus.includes(wf.status as string)) return false
    if (selectedModule.length && !(wf.steps ?? []).some(s => selectedModule.includes(s.type as string))) return false
    return true
  })

  return { viewMode, setViewMode, visibleWorkflows }
}
