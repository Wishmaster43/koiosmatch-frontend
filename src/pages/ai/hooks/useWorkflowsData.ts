/**
 * Workflow list data + mutations. Loads workflows/folders from the API, merges
 * the localStorage graph cache (C-27 — the backend doesn't persist step
 * connections yet), and exposes save/run/toggle-status/folder CRUD. Extracted
 * from WorkflowsPage so the page stays a thin container (§3A); this hook owns
 * everything that talks to the backend or localStorage for this page.
 */
import { useState, useEffect, useRef } from 'react'
import { notify, notifyError } from '@/lib/notify'
import { useTranslation } from 'react-i18next'
import api, { unwrap, unwrapList } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { extractApiError } from '@/lib/extractApiError'
import { normalizeWorkflow, denormalizeWorkflow } from '../data/workflowMap'
import type { Workflow, RawWorkflow } from '@/types/workflow'

// A workflow folder (left sidebar grouping).
export interface WorkflowFolder { id: string | number; name: string; [k: string]: unknown }
export type FolderId = string | number | null

// Fetches workflows/folders and exposes every mutation the page needs.
// `showArchived` drives the fetch (soft-deleted rows, C-27-workflow).
export function useWorkflowsData(showArchived: boolean) {
  const { t } = useTranslation(['workflows', 'common'])
  // Folder create/delete is settings.update-gated on the backend (R-3); mirror it in the UI.
  const canManageFolders = useAuth()?.hasPermission('settings.update') ?? false
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [folders,   setFolders]   = useState<WorkflowFolder[]>([])
  const [loading,   setLoading]   = useState(true)
  // C-16: a failed /workflows fetch used to fall back to [] silently (indistinguishable
  // from "no workflows yet"). Track it explicitly so the page can show a real error +
  // retry instead of a misleading empty state. The folders sidebar is secondary data —
  // its own failure still degrades quietly to an empty sidebar.
  const [error,     setError]     = useState(false)
  const [fetchTick, setFetchTick] = useState(0)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  // RUN-CONTROL-1: after a 409 "already running", open the editor focused on that run.
  const [focusRunId, setFocusRunId] = useState<string | number | null>(null)
  // Folder navigation (sidebar selection + drag target) lives alongside the folder
  // CRUD below, since deleteFolder needs to clear the selection when it's the deleted one.
  const [selectedFolder, setSelectedFolder] = useState<FolderId>(null)   // null = alle, 'unassigned' = geen folder, uuid = folder
  const [dragOverFolder, setDragOverFolder] = useState<FolderId>(null)
  const dragWf = useRef<string | number | null>(null)

  useEffect(() => {
    // Archived view asks the backend for soft-deleted rows too (C-27-workflow).
    setLoading(true); setError(false)
    Promise.allSettled([
      api.get('/workflows', { params: showArchived ? { include_archived: 1 } : {} }),
      api.get('/workflow-folders'),
    ]).then(([wfResult, folderResult]) => {
      if (wfResult.status === 'rejected') {
        // The primary list failed to load — a real error, not "no workflows yet".
        setError(true)
        setWorkflows([])
      } else {
        const wfs = unwrapList<RawWorkflow>(wfResult.value).rows.map(normalizeWorkflow)
        // Restore graph from localStorage when the backend doesn't store connections yet
        // (C-27). The cached steps are self-consistent (node IDs match edge source/target),
        // so use them wholesale rather than merging with server step IDs which would mismatch.
        const merged = wfs.map((wf: Workflow) => {
          const serverHasGraph = wf.steps.some(s => Array.isArray(s.next) && s.next.length)
          if (serverHasGraph) return wf           // backend already stores the graph → trust it
          const raw = localStorage.getItem(`wf_graph_${wf.id}`)
          if (!raw) return wf
          try {
            const cachedSteps = JSON.parse(raw)
            return { ...wf, steps: cachedSteps }  // cached steps have consistent ids + next[]
          } catch { return wf }
        })
        setWorkflows(merged)
      }
      // Folders are secondary (sidebar-only) — a failure there still degrades quietly.
      setFolders(folderResult.status === 'fulfilled' ? unwrapList<WorkflowFolder>(folderResult.value).rows : [])
    }).finally(() => setLoading(false))
  }, [showArchived, fetchTick])

  // Manual retry — bumps the tick so the load effect above re-runs.
  const retryLoad = () => setFetchTick(v => v + 1)

  // Open the editor; a normal edit clears any lingering 409 run focus.
  const openEditor = (wf: Workflow, runId: string | number | null = null) => {
    setFocusRunId(runId)
    setEditingWorkflow(wf)
  }

  // Closes the canvas editor and clears the 409 run focus with it.
  const closeEditor = () => {
    setEditingWorkflow(null)
    setFocusRunId(null)
  }

  const handleRun = async (id?: string | number) => {
    try {
      // 409 (already running) is handled below with its own toast + builder focus.
      await api.post(`/workflows/${id}/run`, undefined, { quietStatuses: [409] })
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { run_id?: string | number } } }
      // RUN-CONTROL-1 single-flight 409: this workflow already has a live run —
      // say so (i18n) and open the builder pointed at that run (stop lives there).
      if (e.response?.status === 409) {
        notify('info', t('runControl.alreadyRunning'))
        const wf = workflows.find(w => w.id === id)
        if (wf) openEditor(wf, e.response.data?.run_id ?? null)
        return
      }
      notifyError(t('common:actionFailed'))
    }
  }

  // Active/draft toggle (list-row switch) — same semantics as the editor's status
  // button (active <-> inactive); optimistic, rolled back on failure (mirrors moveToFolder).
  const handleToggleStatus = (wf: Workflow) => {
    const nextStatus = wf.status === 'active' ? 'inactive' : 'active'
    setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, status: nextStatus } : w))
    const payload = { ...denormalizeWorkflow({ ...wf, status: nextStatus }), folder_id: wf.folder_id ?? null }
    api.put(`/workflows/${wf.id}`, payload).catch(() => {
      setWorkflows(prev => prev.map(w => w.id === wf.id ? { ...w, status: wf.status } : w))
      notifyError(t('common:actionFailed'))
    })
  }

  const handleSave = async (updated: Workflow, closeAfter = true) => {
    if (!updated.steps || updated.steps.length === 0) {
      alert(t('page.addModuleAlert'))
      return
    }
    const isNew = !updated.id || !workflows.some(w => w.id === updated.id)
    const payload = { ...denormalizeWorkflow(updated), folder_id: updated.folder_id ?? null }
    try {
      const res = isNew
        ? await api.post('/workflows', payload)
        : await api.put(`/workflows/${updated.id}`, payload)
      // Keep frontend graph (steps with next/position) as source of truth — backend
      // doesn't store connections yet (C-27). Persist to localStorage so Cmd+R survives.
      const serverData = normalizeWorkflow(unwrap<RawWorkflow>(res))
      const savedWorkflow = { ...updated, id: serverData.id ?? updated.id }
      localStorage.setItem(`wf_graph_${savedWorkflow.id}`, JSON.stringify(savedWorkflow.steps))
      setWorkflows(prev => isNew ? [...prev, savedWorkflow] : prev.map(w => w.id === savedWorkflow.id ? savedWorkflow : w))
      if (closeAfter) {
        setEditingWorkflow(null)
      } else if (isNew) {
        // Only patch the id — don't replace the whole object so the canvas isn't disrupted
        setEditingWorkflow(prev => prev ? { ...prev, id: savedWorkflow.id } : prev)
      }
      // else: editor keeps its own state; no prop change needed
    } catch (err) {
      // WF-R2 saves validate the graph server-side (loop / disconnected step): surface
      // the SPECIFIC 422 detail via the shared extractApiError helper — never a raw
      // axios/network string in the user-facing message (§10).
      alert(t('page.saveFailed', { msg: extractApiError(err, t('common:actionFailed')) }))
    }
  }

  const createFolder = async (name: string) => {
    try {
      const res = await api.post('/workflow-folders', { name })
      setFolders(prev => [...prev, unwrap<WorkflowFolder>(res)])
    } catch {
      // A failed create used to fail silently — give the same feedback as every other mutation here.
      notifyError(t('common:actionFailed'))
    }
  }

  const deleteFolder = async (folder: WorkflowFolder) => {
    if (!canManageFolders) return
    if (!confirm(t('page.deleteFolderConfirm', { name: folder.name }))) return
    try {
      await api.delete(`/workflow-folders/${folder.id}`)
      setFolders(prev => prev.filter(f => f.id !== folder.id))
      setWorkflows(prev => prev.map(w => w.folder_id === folder.id ? { ...w, folder_id: null } : w))
      if (selectedFolder === folder.id) setSelectedFolder(null)
    } catch (e) {
      // 409 = the folder still holds active workflows → backend blocks the delete (R-3).
      const status = (e as { response?: { status?: number } })?.response?.status
      notifyError(t(status === 409 ? 'page.deleteFolderInUse' : 'common:actionFailed'))
    }
  }

  const moveToFolder = async (workflowId: string | number | null, folderId: FolderId) => {
    setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, folder_id: folderId } : w))
    const wf = workflows.find(w => w.id === workflowId)
    if (!wf) return
    const payload = { ...denormalizeWorkflow(wf), folder_id: folderId }
    api.put(`/workflows/${workflowId}`, payload).catch(() => {
      // Roll back the optimistic move and say so — mirrors handleToggleStatus's rollback+toast.
      setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, folder_id: wf.folder_id } : w))
      notifyError(t('common:actionFailed'))
    })
  }

  return {
    workflows, folders, loading, error, canManageFolders,
    editingWorkflow, focusRunId,
    selectedFolder, setSelectedFolder, dragOverFolder, setDragOverFolder, dragWf,
    retryLoad, openEditor, closeEditor,
    handleRun, handleToggleStatus, handleSave,
    createFolder, deleteFolder, moveToFolder,
  }
}
