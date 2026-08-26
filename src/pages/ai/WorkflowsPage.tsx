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
import { useOpenFromIntent } from '@/context/NavigationContext'
import { useDrawerUrl } from '@/hooks/useDrawerUrl'
import { useSeedLabel } from '@/lib/useSeedLabel'
import { useWorkflowsData } from './hooks/useWorkflowsData'
import { useWorkflowsFilters } from './hooks/useWorkflowsFilters'
import WorkflowFolderSidebar from './WorkflowFolderSidebar'
import WorkflowsListPanel from './WorkflowsListPanel'
import WorkflowNotFound from './WorkflowNotFound'
import type { Workflow } from '@/types/workflow'

// Cross-entity navigation intent (EntityLink/openEntity's `{ open: id }`) — the
// same shape every other entity page's `intent` prop carries.
interface WorkflowsIntent { open?: string | number }

export default function WorkflowsPage({ intent }: { intent?: WorkflowsIntent } = {}) {
  // Archived (soft-deleted) view — off by default; drives both the data fetch
  // (include_archived param) and the visible-list filter, so it lives here.
  const [showArchived, setShowArchived] = useState(false)
  // TRASH-OVERAL-2: the Prullenbak view (lifecycle pending_erase) — exclusive with
  // the archived view; both ride the same include_archived fetch.
  const [showTrash, setShowTrash] = useState(false)

  const data = useWorkflowsData(showArchived || showTrash)
  const { viewMode, setViewMode, visibleWorkflows } = useWorkflowsFilters(data.workflows, showArchived, data.selectedFolder, showTrash)

  // WF-EDITOR-DEEPLINK-1: the open editor is URL-driven — #aiagents?open=<id> —
  // so F5/back/forward/new-tab all land IN the editor, and a cross-entity link
  // (WorkflowRefs/result cards) opens it too. `selectedId` covers BOTH the
  // editor being open (a real workflow) and the honest not-found state (a
  // resolved-missing id) — either way something is "open" as far as the URL
  // and browser history are concerned; closing either clears the param.
  useOpenFromIntent(intent, id => data.openEditorById(id))
  useDrawerUrl({
    selectedId: data.editingWorkflow?.id ?? data.notFoundId ?? undefined,
    openById: id => data.openEditorById(id),
    close: data.closeEditor,
    intent,
  })

  // TRASH-OVERAL-2: mark is workflows.delete-gated (HIDDEN without — §7 no fake
  // affordances); unmark reuses settings.update, the same gate the archive/restore
  // actions carry here (canManageFolders). A mark/unmark refetches the list.
  const canMarkDeletion = useAuth()?.hasPermission('workflows.delete') ?? false
  const trash = useTrashFlow({
    entityPath: 'workflows',
    onMarked: () => data.retryLoad(),
    onUnmarked: () => data.retryLoad(),
  })
  // LOOKUP-I18N-1: the trash preview shows the same (translated) name as the row.
  const seedLabel = useSeedLabel()
  // Opens the trash-mark confirm for one workflow, previewing it under its
  // (possibly tenant-renamed) translated name.
  const openMarkDeletion = (wf: Workflow) => {
    if (wf.id == null) return
    trash.openFor(String(wf.id), seedLabel('workflowNames', { label: wf.name ?? null }) || String(wf.id))
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
        // WF-RELATIONS-FE-1: `key` forces a full remount when the editor swaps to
        // a DIFFERENT workflow (a relations-panel click) — without it the editor's
        // internal state (useWorkflowEditor's useState seeds) would keep showing
        // the previous workflow's graph even though the `workflow` prop changed.
        <WorkflowCanvasEditor
          key={String(data.editingWorkflow.id ?? 'new')}
          workflow={data.editingWorkflow}
          initialRunId={data.focusRunId}
          onClose={data.closeEditor}
          onSave={data.handleSave}
        />
      )}
      {/* WF-EDITOR-DEEPLINK-1: an id the loaded list doesn't have — a stale link
          or a typo, never a silent blank screen. */}
      {data.notFoundId != null && <WorkflowNotFound onClose={data.closeEditor} />}
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
