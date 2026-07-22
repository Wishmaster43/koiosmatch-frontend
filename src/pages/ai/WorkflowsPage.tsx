/**
 * Workflows — the workflows list/manager page.
 *
 * Lists workflows (grouped into folders), lets you create, run, and delete them,
 * and opens the visual builder (WorkflowCanvasEditor) to edit one. Shows each
 * workflow's status and last run.
 *
 * Thin container (§3A): data/mutations live in hooks/useWorkflowsData (fetch,
 * save/run/toggle-status, folder CRUD, graph-cache persistence) and
 * hooks/useWorkflowsFilters (view mode + right-panel filters + visible list);
 * JSX is split into WorkflowFolderSidebar (left column) and WorkflowsListPanel
 * (toolbar + grid/list). Data mapping lives in data/workflowMap.js.
 */
import { useState } from 'react'
import WorkflowCanvasEditor from '@/components/layout/WorkflowCanvasEditor'
import { useWorkflowsData } from './hooks/useWorkflowsData'
import { useWorkflowsFilters } from './hooks/useWorkflowsFilters'
import WorkflowFolderSidebar from './WorkflowFolderSidebar'
import WorkflowsListPanel from './WorkflowsListPanel'

export default function WorkflowsPage() {
  // Archived (soft-deleted) view — off by default; drives both the data fetch
  // (include_archived param) and the visible-list filter, so it lives here.
  const [showArchived, setShowArchived] = useState(false)

  const data = useWorkflowsData(showArchived)
  const { viewMode, setViewMode, visibleWorkflows } = useWorkflowsFilters(data.workflows, showArchived, data.selectedFolder)

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Folder sidebar — drag targets */}
      <WorkflowFolderSidebar
        folders={data.folders}
        canManageFolders={data.canManageFolders}
        selectedFolder={data.selectedFolder}
        setSelectedFolder={data.setSelectedFolder}
        dragOverFolder={data.dragOverFolder}
        setDragOverFolder={data.setDragOverFolder}
        dragWf={data.dragWf}
        createFolder={data.createFolder}
        deleteFolder={data.deleteFolder}
        moveToFolder={data.moveToFolder}
      />

      {/* Content */}
      <WorkflowsListPanel
        loading={data.loading}
        error={data.error}
        retryLoad={data.retryLoad}
        visibleWorkflows={visibleWorkflows}
        folders={data.folders}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        selectedFolder={data.selectedFolder}
        dragWf={data.dragWf}
        openEditor={data.openEditor}
        handleRun={data.handleRun}
        handleToggleStatus={data.handleToggleStatus}
      />

      {data.editingWorkflow && (
        <WorkflowCanvasEditor
          workflow={data.editingWorkflow}
          initialRunId={data.focusRunId}
          onClose={data.closeEditor}
          onSave={data.handleSave}
        />
      )}
    </div>
  )
}
