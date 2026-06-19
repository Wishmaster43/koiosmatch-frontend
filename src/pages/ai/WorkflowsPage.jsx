/**
 * Workflows — the workflows list/manager page.
 *
 * Lists workflows (grouped into folders), lets you create, run, and delete them,
 * and opens the visual builder (WorkflowCanvasEditor) to edit one. Shows each
 * workflow's status and last run.
 *
 * Main blocks below:
 *   - MODULE_META   → local label/icon lookup for the module chips shown per workflow
 *   - (further down)→ folder tree, workflow rows, run/create handlers, editor mount
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import {
  Zap, Users, Calendar, MessageCircle, Database,
  Mail, Clock, Play, Plus, MoreHorizontal,
  CheckCircle, AlertCircle, Loader2,
  Folder, FolderPlus, Trash2,
} from 'lucide-react'
import WorkflowCanvasEditor from '../../components/layout/WorkflowCanvasEditor'

// Module chip icon + colours; label = t('modules.<type>').
const MODULE_META = {
  candidate_filter: { Icon: Users,         color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  shift_fetcher:    { Icon: Calendar,      color: '#0F6E56', bg: '#E1F5EE' },
  whatsapp_send:    { Icon: MessageCircle, color: '#3B6D11', bg: '#EAF3DE' },
  database_update:  { Icon: Database,      color: '#185FA5', bg: '#E6F1FB' },
  email_send:       { Icon: Mail,          color: '#854F0B', bg: '#FAEEDA' },
  delay:            { Icon: Clock,         color: '#5F5E5A', bg: '#F1EFE8' },
}

const MOCK_WORKFLOWS = [
  {
    id: 1,
    name: 'Diensten Aanbod — Yesway',
    trigger: 'Dagelijks 08:00',
    status: 'active',
    last_run: { time: 'Vandaag 08:00', ok: true, candidates: 87 },
    steps: [
      { type: 'candidate_filter', config: { status: 'actief', pools: ['Pool 7', 'Pool 8'], limit: 100 } },
      { type: 'shift_fetcher',    config: { connection_id: 'ShiftManager (Yesway)', hours_ahead: 72 } },
      { type: 'whatsapp_send',    config: { message_type: 'flow', phone_number_id: '085 020 5160' } },
      { type: 'database_update',  config: { model: 'Conversation', set_status: 'AWAITING_SHIFTS_OFFERED' } },
    ],
  },
  {
    id: 2,
    name: 'No Response Checker',
    trigger: 'Dagelijks 09:00',
    status: 'active',
    last_run: { time: 'Vandaag 09:00', ok: true, candidates: 12 },
    steps: [
      { type: 'candidate_filter', config: { status: 'actief' } },
      { type: 'whatsapp_send',    config: { message_type: 'template', template_name: 'geen_reactie' } },
      { type: 'database_update',  config: { model: 'Conversation' } },
    ],
  },
  {
    id: 3,
    name: 'Shift Reminder',
    trigger: 'Dagelijks 10:00',
    status: 'active',
    last_run: { time: 'Vandaag 10:00', ok: false, error: 'API timeout' },
    steps: [
      { type: 'candidate_filter', config: {} },
      { type: 'shift_fetcher',    config: {} },
      { type: 'whatsapp_send',    config: { message_type: 'template' } },
    ],
  },
  {
    id: 4,
    name: 'Wekelijkse Rapportage',
    trigger: 'Maandag 07:00',
    status: 'draft',
    last_run: null,
    steps: [
      { type: 'candidate_filter', config: {} },
      { type: 'email_send',       config: { to: 'flex@yesway.nu' } },
    ],
  },
]

// Status badge colours; label = t('status.<key>').
const STATUS_STYLES = {
  active:   { bg: '#F0FDF4', color: 'var(--color-success)', dot: 'var(--color-success)' },
  draft:    { bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
  inactive: { bg: '#FFF7ED', color: '#C2410C', dot: '#F97316' },
}

function StepPill({ type }) {
  const { t } = useTranslation('workflows')
  const meta = MODULE_META[type]
  if (!meta) return null
  const Icon = meta.Icon
  const label = t(`modules.${type}`, { defaultValue: type })
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: meta.bg, color: meta.color }}
      title={label}
    >
      <Icon size={11} />
      <span>{label}</span>
    </div>
  )
}

function WorkflowCard({ workflow, onRun, onEdit }) {
  const { t } = useTranslation('workflows')
  const [running, setRunning] = useState(false)
  const status = STATUS_STYLES[workflow.status] || STATUS_STYLES.draft

  const handleRun = async () => {
    setRunning(true)
    await onRun(workflow.id)
    setTimeout(() => setRunning(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4 p-5 bg-white rounded-xl" style={{ border: '1px solid #F3F4F6' }}>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center min-w-0 gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ width: 36, height: 36, background: 'var(--color-primary-bg)' }}
          >
            <Zap size={16} color="var(--color-primary)" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate" style={{ fontSize: 14 }}>
              {workflow.name}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{workflow.trigger}</div>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 flex-shrink-0"
          style={{ background: status.bg, color: status.color }}
        >
          <span className="flex-shrink-0 rounded-full" style={{ width: 5, height: 5, background: status.dot }} />
          <span style={{ fontSize: 11, fontWeight: 500 }}>{t(`status.${workflow.status}`, { defaultValue: workflow.status })}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {workflow.steps.map((step, i) => <StepPill key={i} type={step.type} />)}
      </div>

      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #F9FAFB' }}>
        <div className="flex items-center gap-1.5">
          {workflow.last_run ? (
            <>
              {workflow.last_run.ok
                ? <CheckCircle size={13} color="var(--color-success)" />
                : <AlertCircle size={13} color="var(--color-danger)" />
              }
              <span className="text-xs text-gray-400">
                {workflow.last_run.ok
                  ? `${workflow.last_run.time} · ${t('page.candidates', { n: workflow.last_run.candidates })}`
                  : `${workflow.last_run.time} · ${workflow.last_run.error}`
                }
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-300">{t('page.notRun')}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              background: running ? '#F3F4F6' : 'var(--color-primary-bg)',
              color: running ? '#9CA3AF' : 'var(--color-primary)',
              border: 'none',
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? t('page.running') : t('page.run')}
          </button>

          <button
            onClick={onEdit}
            className="flex items-center justify-center transition-colors rounded-lg"
            style={{ width: 28, height: 28, background: '#F9FAFB', border: '1px solid #F3F4F6', cursor: 'pointer', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// Vertaal backend formaat → frontend formaat
function normalizeWorkflow(wf) {
  // trigger: string samengesteld uit trigger_type + trigger_config, of al een string
  const trigger = typeof wf.trigger === 'string'
    ? wf.trigger
    : wf.trigger_type ?? 'Handmatig'

  // status: active boolean → string
  const status = typeof wf.status === 'string'
    ? wf.status
    : (wf.active ? 'active' : 'inactive')

  // steps: altijd normaliseren naar { id, type, config, position }
  const rawSteps = Array.isArray(wf.steps) ? wf.steps : (wf.workflow_steps ?? [])
  const steps = rawSteps.map(s => ({
    id:       s.id ? String(s.id) : undefined,
    type:     s.module_type ?? s.type,
    config:   s.config ?? s.parameters ?? {},
    position: s.position ?? undefined,
  }))

  // last_run: uit laatste WorkflowRun of direct
  const lastRun = wf.last_run ?? (wf.latest_run
    ? { time: wf.latest_run.created_at, ok: wf.latest_run.status === 'success' }
    : null)

  return { ...wf, trigger, status, steps, last_run: lastRun }
}

// Vertaal frontend trigger string → trigger_type + trigger_config
function parseTrigger(trigger) {
  if (!trigger || trigger === 'Handmatig') return { trigger_type: 'manual', trigger_config: {} }
  if (trigger.toLowerCase().includes('webhook')) return { trigger_type: 'webhook', trigger_config: {} }
  // "Dagelijks 08:00", "Elk uur", "Maandag 07:00" → scheduled
  const timeMatch = trigger.match(/(\d{2}:\d{2})/)
  return {
    trigger_type: 'scheduled',
    trigger_config: { schedule_label: trigger, schedule_time: timeMatch?.[1] ?? '09:00' },
  }
}

// Vertaal frontend formaat → backend formaat voor opslaan
function denormalizeWorkflow(wf) {
  const { trigger_type, trigger_config } = parseTrigger(wf.trigger)
  return {
    name:           wf.name,
    trigger_type,
    trigger_config: wf.schedule ? { ...trigger_config, schedule: wf.schedule } : trigger_config,
    active:         wf.status === 'active',
    status:         wf.status ?? 'draft',
    steps:          (wf.steps ?? []).map((s, i) => ({
      module_type: s.type,
      config:      s.config ?? {},
      label:       s.label ?? null,
      order:       i,
    })),
  }
}

// ── Folder sidebar ────────────────────────────────────────────────────────────

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { t } = useTranslation('workflows')
  const [workflows,       setWorkflows]       = useState([])
  const [folders,         setFolders]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [selectedFolder,  setSelectedFolder]  = useState(null)   // null = alle, 'unassigned' = geen folder, uuid = folder
  const [editingWorkflow, setEditingWorkflow] = useState(null)
  const [dragOverFolder,  setDragOverFolder]  = useState(null)
  const dragWf = useRef(null)

  useEffect(() => {
    Promise.all([
      api.get('/workflows').then(r => (r.data?.data ?? r.data ?? []).map(normalizeWorkflow)).catch(() => MOCK_WORKFLOWS),
      api.get('/workflow-folders').then(r => r.data?.data ?? r.data ?? []).catch(() => []),
    ]).then(([wfs, flds]) => {
      setWorkflows(wfs)
      setFolders(flds)
    }).finally(() => setLoading(false))
  }, [])

  const handleRun = async (id) => {
    await api.post(`/workflows/${id}/run`).catch(() => api.post(`/workflows/${id}/execute`)).catch(() => {})
  }

  const handleSave = async (updated) => {
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
      const saved = normalizeWorkflow(res.data?.data ?? res.data)
      setWorkflows(prev => isNew ? [...prev, saved] : prev.map(w => w.id === saved.id ? saved : w))
      setEditingWorkflow(null)
    } catch (err) {
      alert(t('page.saveFailed', { msg: err.response?.data?.message ?? err.message }))
    }
  }

  const createFolder = async (name) => {
    try {
      const res = await api.post('/workflow-folders', { name })
      setFolders(prev => [...prev, res.data?.data ?? res.data])
    } catch { /* noop */ }
  }

  const deleteFolder = async (folder) => {
    if (!confirm(t('page.deleteFolderConfirm', { name: folder.name }))) return
    try {
      await api.delete(`/workflow-folders/${folder.id}`)
      setFolders(prev => prev.filter(f => f.id !== folder.id))
      setWorkflows(prev => prev.map(w => w.folder_id === folder.id ? { ...w, folder_id: null } : w))
      if (selectedFolder === folder.id) setSelectedFolder(null)
    } catch { /* noop */ }
  }

  const moveToFolder = async (workflowId, folderId) => {
    setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, folder_id: folderId } : w))
    const wf = workflows.find(w => w.id === workflowId)
    if (!wf) return
    const payload = { ...denormalizeWorkflow(wf), folder_id: folderId }
    api.put(`/workflows/${workflowId}`, payload).catch(() => {
      setWorkflows(prev => prev.map(w => w.id === workflowId ? { ...w, folder_id: wf.folder_id } : w))
    })
  }

  const visibleWorkflows = workflows.filter(wf => {
    if (selectedFolder === null) return true
    if (selectedFolder === 'unassigned') return !wf.folder_id
    return wf.folder_id === selectedFolder
  })

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Folder sidebar — drag targets */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t('page.folders')}</span>
          <button onClick={() => {
            const name = prompt(t('page.folderNamePrompt'))
            if (name?.trim()) createFolder(name.trim())
          }} title={t('page.newFolder')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex' }}>
            <FolderPlus size={15} />
          </button>
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
          <div style={{ height: 1, background: '#F3F4F6', margin: '4px 12px' }} />
          {folders.map(f => (
            <SidebarRow key={f.id} label={f.name} icon={<Folder size={13} />}
              active={selectedFolder === f.id}
              isDragOver={dragOverFolder === f.id}
              onClick={() => setSelectedFolder(f.id)}
              onDragOver={e => { e.preventDefault(); setDragOverFolder(f.id) }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={() => { moveToFolder(dragWf.current, f.id); setDragOverFolder(null) }}
              onDelete={() => deleteFolder(f)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>
              {selectedFolder === null ? t('page.allWorkflows')
               : selectedFolder === 'unassigned' ? t('page.unassigned')
               : (folders.find(f => f.id === selectedFolder)?.name ?? t('page.workflowsTitle'))}
            </h2>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{t('page.countWorkflows', { n: visibleWorkflows.length })}</p>
          </div>
          <button
            onClick={() => setEditingWorkflow({ name: t('page.newWorkflow'), trigger: 'Dagelijks 08:00', status: 'draft', last_run: null, steps: [], folder_id: selectedFolder === 'unassigned' ? null : (selectedFolder ?? null) })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 500, color: 'white', background: 'var(--color-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            <Plus size={14} /> {t('page.newWorkflow')}
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> {t('page.loading')}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {visibleWorkflows.map(wf => (
              <div key={wf.id} draggable
                onDragStart={() => { dragWf.current = wf.id }}
                onDragEnd={() => { dragWf.current = null }}
                style={{ cursor: 'grab' }}
              >
                <WorkflowCard workflow={wf} onRun={handleRun} onEdit={() => setEditingWorkflow(wf)} />
              </div>
            ))}
            {visibleWorkflows.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 14 }}>
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

function SidebarRow({ label, icon, active, isDragOver, onClick, onDragOver, onDragLeave, onDrop, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
        cursor: 'pointer', borderRadius: 6, margin: '1px 6px',
        background: isDragOver ? 'var(--color-secondary-bg)' : active ? 'var(--color-primary-bg)' : hover ? '#F9FAFB' : 'transparent',
        border: isDragOver ? '1.5px dashed var(--color-secondary)' : '1.5px solid transparent',
        color: active ? 'var(--color-primary)' : '#374151',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ color: isDragOver ? 'var(--color-secondary)' : active ? 'var(--color-primary)' : '#9CA3AF', flexShrink: 0 }}>{icon}</span>
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