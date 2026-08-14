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
import { useAuth } from '@/context/AuthContext'
import { useTrashFlow } from '@/hooks/useTrashFlow'
import DeletionPreviewModal from '@/components/ui/DeletionPreviewModal'
import { useWorkflowsData } from './hooks/useWorkflowsData'
import { useWorkflowsFilters } from './hooks/useWorkflowsFilters'
import WorkflowFolderSidebar from './WorkflowFolderSidebar'
import WorkflowsListPanel from './WorkflowsListPanel'
import type { Workflow } from '@/types/workflow'

export default function WorkflowsPage() {
  // Archived (soft-deleted) view — off by default; drives both the data fetch
  // (include_archived param) and the visible-list filter, so it lives here.
  const [showArchived, setShowArchived] = useState(false)
  // TRASH-OVERAL-2: the Prullenbak view (lifecycle pending_erase) — exclusive with
  // the archived view; both ride the same include_archived fetch.
  const [showTrash, setShowTrash] = useState(false)

  const data = useWorkflowsData(showArchived || showTrash)
  const { viewMode, setViewMode, visibleWorkflows } = useWorkflowsFilters(data.workflows, showArchived, data.selectedFolder, showTrash)

  // TRASH-OVERAL-2: mark is workflows.delete-gated (HIDDEN without — §7 no fake
  // affordances); unmark reuses settings.update, the same gate the archive/restore
  // actions carry here (canManageFolders). A mark/unmark refetches the list.
  const canMarkDeletion = useAuth()?.hasPermission('workflows.delete') ?? false
  const trash = useTrashFlow({
    entityPath: 'workflows',
    onMarked: () => data.retryLoad(),
    onUnmarked: () => data.retryLoad(),
  })
  const openMarkDeletion = (wf: Workflow) => {
    if (wf.id == null) return
    trash.openFor(String(wf.id), wf.name ?? String(wf.id))
  }

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
        // The two lifecycle views are exclusive (TRASH-OVERAL-2, mirrors candidates).
        onToggleArchived={() => { setShowArchived(v => !v); setShowTrash(false) }}
        showTrash={showTrash}
        onToggleTrash={() => { setShowTrash(v => !v); setShowArchived(false) }}
        selectedFolder={data.selectedFolder}
        dragWf={data.dragWf}
        openEditor={data.openEditor}
        handleRun={data.handleRun}
        handleToggleStatus={data.handleToggleStatus}
        canManageFolders={data.canManageFolders}
        handleArchive={data.handleArchive}
        handleRestore={data.handleRestore}
        onMarkDeletion={canMarkDeletion ? openMarkDeletion : undefined}
        onUnmark={data.canManageFolders ? (wf) => { if (wf.id != null) trash.unmark(String(wf.id)) } : undefined}
        graceDays={trash.graceDays}
      />

      {data.editingWorkflow && (
        <WorkflowCanvasEditor
          workflow={data.editingWorkflow}
          initialRunId={data.focusRunId}
          onClose={data.closeEditor}
          onSave={data.handleSave}
        />
      )}
      {data.dialog}
      {/* TRASH-OVERAL-2: the ONE shared "Definitief verwijderen" preview dialog.
          Workflows carry no transferable owner (preview.transferable stays null),
          so the modal renders without the transfer picker by itself. */}
      {trash.target && (
        <DeletionPreviewModal open onClose={trash.close} entityLabel={trash.target.label}
          preview={trash.preview} loading={trash.loading} error={trash.error}
          users={[]} onConfirm={trash.confirmMark} busy={trash.busy} blocked={trash.blocked}
          graceDays={trash.graceDays} />
      )}
    </div>
  )
}
