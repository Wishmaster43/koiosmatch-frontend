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
export function useWorkflowsFilters(workflows: Workflow[], showArchived: boolean, selectedFolder: FolderId) {
  const { t } = useTranslation(['workflows', 'common'])
  // List is the Make.com-style default; the choice persists across reloads (localStorage, non-PII).
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode)
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  // Right-panel filters (status + module type) — registering them shows the topbar
  // filter button, just like the candidates/planning pages.
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedModule, setSelectedModule] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const statusOptions = useMemo(() => [...new Set(workflows.map(w => w.status))].filter((v): v is string => Boolean(v))
    .map(v => ({ value: v, label: t(`status.${v}`, { defaultValue: v }), count: workflows.filter(w => w.status === v).length })), [workflows, t])
  const moduleOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    workflows.forEach(w => new Set((w.steps ?? []).map(s => s.type).filter((x): x is string => Boolean(x))).forEach(ty => { counts[ty] = (counts[ty] ?? 0) + 1 }))
    return Object.keys(counts).map(v => ({ value: v, label: t(`modules.${v}`, { defaultValue: v }), count: counts[v] }))
  }, [workflows, t])

  const filterGroups = useMemo(() => [
    { key: 'status', label: t('filters.status'), selected: selectedStatus, options: statusOptions,
      onToggle: (v: string) => setSelectedStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
    { key: 'module', label: t('filters.module'), selected: selectedModule, options: moduleOptions,
      onToggle: (v: string) => setSelectedModule(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedStatus, selectedModule, statusOptions, moduleOptions])

  useEffect(() => {
    registerFilters('workflows-page', filterGroups)
    return () => unregisterFilters('workflows-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const visibleWorkflows = workflows.filter(wf => {
    // Archived (soft-deleted) hidden by default; the archived view shows only those.
    if (showArchived ? !wf.archived : wf.archived) return false
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
