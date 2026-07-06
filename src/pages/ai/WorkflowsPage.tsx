/**
 * Workflows — the workflows list/manager page.
 *
 * Lists workflows (grouped into folders), lets you create, run, and delete them,
 * and opens the visual builder (WorkflowCanvasEditor) to edit one. Shows each
 * workflow's status and last run.
 *
 * Composes WorkflowCard (the tiles) + the folder sidebar; data mapping lives in
 * data/workflowMap.js.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import type { ReactNode, DragEvent } from 'react'
import { interactive } from '@/lib/a11y'
import { notifyError } from '@/lib/notify'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useRightPanel } from '@/context/RightPanelContext'
import { useAuth } from '@/context/AuthContext'
import { Zap, Plus, Loader2, Folder, FolderPlus, Trash2, LayoutGrid, List, Archive } from 'lucide-react'
import WorkflowCanvasEditor from '@/components/layout/WorkflowCanvasEditor'
import { normalizeWorkflow, denormalizeWorkflow } from './data/workflowMap'
import WorkflowCard, { WorkflowRow } from './WorkflowCard'
import type { Workflow } from '@/types/workflow'

// A workflow folder (left sidebar grouping).
interface WorkflowFolder { id: string | number; name: string; [k: string]: unknown }
type FolderId = string | number | null

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { t } = useTranslation('workflows')
  // Folder create/delete is settings.update-gated on the backend (R-3); mirror it in the UI.
  const canManageFolders = useAuth()?.hasPermission('settings.update') ?? false
  const [workflows,       setWorkflows]       = useState<Workflow[]>([])
  const [folders,         setFolders]         = useState<WorkflowFolder[]>([])
  const [loading,         setLoading]         = useState(true)
  const [selectedFolder,  setSelectedFolder]  = useState<FolderId>(null)   // null = alle, 'unassigned' = geen folder, uuid = folder
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [dragOverFolder,  setDragOverFolder]  = useState<FolderId>(null)
  const [viewMode,        setViewMode]        = useState('grid')  // 'grid' | 'list'
  const [showArchived,    setShowArchived]    = useState(false)   // archived (soft-deleted) off by default
  const dragWf = useRef<string | number | null>(null)

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

  useEffect(() => {
    // Archived view asks the backend for soft-deleted rows too (C-27-workflow).
    setLoading(true)
    Promise.all([
      api.get('/workflows', { params: showArchived ? { include_archived: 1 } : {} }).then(r => (r.data?.data ?? r.data ?? []).map(normalizeWorkflow)).catch(() => []),
      api.get('/workflow-folders').then(r => r.data?.data ?? r.data ?? []).catch(() => []),
    ]).then(([wfs, flds]) => {
      // Restore graph from localStorage when the backend doesn't store connections yet (C-27).
      // The cached steps are self-consistent (node IDs match edge source/target), so use
      // them wholesale rather than merging with server step IDs which would cause mismatches.
      const merged = (wfs as Workflow[]).map((wf: Workflow) => {
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
      setFolders(flds)
    }).finally(() => setLoading(false))
  }, [showArchived])

  const handleRun = async (id?: string | number) => {
    await api.post(`/workflows/${id}/run`).catch(() => api.post(`/workflows/${id}/execute`)).catch(() => notifyError(t('common:actionFailed')))
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
      const serverData = normalizeWorkflow(res.data?.data ?? res.data)
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
      // the SPECIFIC 422 detail, not just the generic message.
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string }
      const detail = Object.values(e.response?.data?.errors ?? {}).flat()[0]
      alert(t('page.saveFailed', { msg: detail ?? e.response?.data?.message ?? e.message }))
    }
  }

  const createFolder = async (name: string) => {
    try {
      const res = await api.post('/workflow-folders', { name })
      setFolders(prev => [...prev, res.data?.data ?? res.data])
    } catch { /* noop */ }
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
      setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, folder_id: wf.folder_id } : w))
    })
  }

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

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Folder sidebar — drag targets */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('page.folders')}</span>
          {canManageFolders && (
            <button onClick={() => {
              const name = prompt(t('page.folderNamePrompt'))
              if (name?.trim()) createFolder(name.trim())
            }} title={t('page.newFolder')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
              <FolderPlus size={15} />
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {[
            { id: null,          label: t('page.allWorkflows'),  icon: <Zap size={13} /> },
            { id: 'unassigned',  label: t('page.unassigned'), icon: <Folder size={13} /> },
          ].map(item => (
            <SidebarRow key={String(item.id)} label={item.label} icon={item.icon}
              active={selectedFolder === item.id}
              isDragOver={dragOverFolder === item.id}
              onClick={() => setSelectedFolder(item.id)}
              onDragOver={e => { e.preventDefault(); setDragOverFolder(item.id) }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={() => { moveToFolder(dragWf.current, item.id === 'unassigned' ? null : item.id); setDragOverFolder(null) }}
            />
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 12px' }} />
          {[...folders].sort((a, b) => a.name.localeCompare(b.name, 'nl')).map(f => (
            <SidebarRow key={f.id} label={f.name} icon={<Folder size={13} />}
              active={selectedFolder === f.id}
              isDragOver={dragOverFolder === f.id}
              onClick={() => setSelectedFolder(f.id)}
              onDragOver={e => { e.preventDefault(); setDragOverFolder(f.id) }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={() => { moveToFolder(dragWf.current, f.id); setDragOverFolder(null) }}
              onDelete={canManageFolders ? () => deleteFolder(f) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {/* Toolbar — add on the LEFT, count + archived + view toggle on the RIGHT (mirror Kansen). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setEditingWorkflow({ name: t('page.newWorkflow'), trigger: 'Dagelijks 08:00', status: 'draft', last_run: null, steps: [], folder_id: selectedFolder === 'unassigned' ? null : (selectedFolder ?? null) })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            <Plus size={14} /> {t('page.newWorkflow')}
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Visible count */}
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('page.countWorkflows', { n: visibleWorkflows.length })}</span>

            {/* Archived (soft-deleted) view toggle */}
            <button onClick={() => setShowArchived(v => !v)} title={t('page.archivedView')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: showArchived ? 600 : 500,
                borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${showArchived ? 'var(--color-primary)' : 'var(--border)'}`,
                background: showArchived ? 'var(--color-primary-bg)' : 'var(--surface)',
                color: showArchived ? 'var(--color-primary)' : 'var(--text)' }}>
              <Archive size={14} /> {t('page.archived')}
            </button>

            {/* View mode toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {[{ mode: 'grid', Icon: LayoutGrid, label: t('page.viewGrid') }, { mode: 'list', Icon: List, label: t('page.viewList') }].map(({ mode, Icon, label }) => (
                <button key={mode} onClick={() => setViewMode(mode)} title={label} aria-label={label}
                  style={{ padding: '6px 10px', background: viewMode === mode ? 'var(--color-primary-bg)' : 'var(--surface)', color: viewMode === mode ? 'var(--color-primary)' : 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> {t('page.loading')}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {visibleWorkflows.map(wf => (
              <div key={wf.id} draggable
                onDragStart={() => { dragWf.current = wf.id ?? null }}
                onDragEnd={() => { dragWf.current = null }}
                style={{ cursor: 'grab' }}
              >
                <WorkflowCard workflow={wf} onRun={handleRun} onEdit={() => setEditingWorkflow(wf)} />
              </div>
            ))}
            {visibleWorkflows.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                {t('page.empty')}
              </div>
            )}
          </div>
        ) : (
          /* List/table view — column table with a header that stays put while rows scroll (R-3). */
          <div style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
            {/* Column header — sticky so it never scrolls out of view (no overflow:hidden ancestor). */}
            <div className="flex items-center gap-3 px-4 py-2" style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div style={{ width: 30, flexShrink: 0 }} />
              <div style={{ width: 220, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('page.colName')}</div>
              <div style={{ width: 80, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('page.colStatus')}</div>
              <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('page.colModules')}</div>
              <div style={{ width: 220, flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('page.colLastRun')}</div>
              <div style={{ width: 100, flexShrink: 0 }} />
            </div>
            {visibleWorkflows.map(wf => (
              <div key={wf.id} draggable
                onDragStart={() => { dragWf.current = wf.id ?? null }}
                onDragEnd={() => { dragWf.current = null }}>
                <WorkflowRow workflow={wf} onRun={handleRun} onEdit={() => setEditingWorkflow(wf)} />
              </div>
            ))}
            {visibleWorkflows.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                {t('page.empty')}
              </div>
            )}
          </div>
        )}
      </div>

      {editingWorkflow && (
        <WorkflowCanvasEditor
          workflow={editingWorkflow}
          onClose={() => setEditingWorkflow(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function SidebarRow({ label, icon, active, isDragOver, onClick, onDragOver, onDragLeave, onDrop, onDelete }: {
  label?: ReactNode; icon?: ReactNode; active?: boolean; isDragOver?: boolean
  onClick?: () => void; onDragOver?: (e: DragEvent) => void; onDragLeave?: () => void; onDrop?: () => void; onDelete?: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <div {...interactive(onClick)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        cursor: 'pointer', borderRadius: 6, margin: '1px 6px',
        background: isDragOver ? 'var(--color-secondary-bg)' : active ? 'var(--color-primary-bg)' : hover ? 'var(--hover-bg)' : 'transparent',
        border: isDragOver ? '1.5px dashed var(--color-secondary)' : '1.5px solid transparent',
        color: active ? 'var(--color-primary)' : 'var(--text)',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ color: isDragOver ? 'var(--color-secondary)' : active ? 'var(--color-primary)' : 'var(--text-muted)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, flex: 1, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {onDelete && hover && (
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 2, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={11} />
        </button>
      )}
    </div>
  )
}