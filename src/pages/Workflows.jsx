import { useState, useEffect } from 'react'
import api from '../lib/api'
import {
  Zap, Users, Calendar, MessageCircle, Database,
  Mail, Clock, Play, Plus, MoreHorizontal,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react'
import WorkflowCanvasEditor from '../components/layout/WorkflowCanvasEditor'

const MODULE_META = {
  candidate_filter: { label: 'Kandidaten Filter', Icon: Users,         color: '#534AB7', bg: '#EEEDFE' },
  shift_fetcher:    { label: 'Diensten Ophalen',  Icon: Calendar,      color: '#0F6E56', bg: '#E1F5EE' },
  whatsapp_send:    { label: 'WhatsApp Sturen',   Icon: MessageCircle, color: '#3B6D11', bg: '#EAF3DE' },
  database_update:  { label: 'Database Updaten',  Icon: Database,      color: '#185FA5', bg: '#E6F1FB' },
  email_send:       { label: 'E-mail Sturen',     Icon: Mail,          color: '#854F0B', bg: '#FAEEDA' },
  delay:            { label: 'Wachttijd',          Icon: Clock,         color: '#5F5E5A', bg: '#F1EFE8' },
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

const STATUS_STYLES = {
  active:   { label: 'Actief',   bg: '#F0FDF4', color: '#16A34A', dot: '#16A34A' },
  draft:    { label: 'Concept',  bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
  inactive: { label: 'Inactief', bg: '#FFF7ED', color: '#C2410C', dot: '#F97316' },
}

function StepPill({ type }) {
  const meta = MODULE_META[type]
  if (!meta) return null
  const Icon = meta.Icon
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: meta.bg, color: meta.color }}
      title={meta.label}
    >
      <Icon size={11} />
      <span>{meta.label}</span>
    </div>
  )
}

function WorkflowCard({ workflow, onRun, onEdit }) {
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
          <span style={{ fontSize: 11, fontWeight: 500 }}>{status.label}</span>
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
                ? <CheckCircle size={13} color="#16A34A" />
                : <AlertCircle size={13} color="#DC2626" />
              }
              <span className="text-xs text-gray-400">
                {workflow.last_run.ok
                  ? `${workflow.last_run.time} · ${workflow.last_run.candidates} kandidaten`
                  : `${workflow.last_run.time} · ${workflow.last_run.error}`
                }
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-300">Nog niet uitgevoerd</span>
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
            {running ? 'Bezig...' : 'Uitvoeren'}
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

export default function WorkflowsPage() {
  const [workflows, setWorkflows]       = useState([])
  const [loading,   setLoading]         = useState(true)
  const [editingWorkflow, setEditingWorkflow] = useState(null)

  useEffect(() => {
    api.get('/workflows')
      .then(res => {
        const raw = res.data?.data ?? res.data ?? []
        setWorkflows(raw.map(normalizeWorkflow))
      })
      .catch(() => setWorkflows(MOCK_WORKFLOWS))
      .finally(() => setLoading(false))
  }, [])

  const handleRun = async (id) => {
    // probeer /run, fallback naar /execute
    await api.post(`/workflows/${id}/run`)
      .catch(() => api.post(`/workflows/${id}/execute`))
      .catch(() => {})
  }

  const handleSave = async (updated) => {
    if (!updated.steps || updated.steps.length === 0) {
      alert('Voeg minimaal één module toe aan de workflow voordat je opslaat.')
      return
    }
    const isNew = !updated.id || !workflows.some(w => w.id === updated.id)
    const payload = denormalizeWorkflow(updated)
    try {
      const res = isNew
        ? await api.post('/workflows', payload)
        : await api.put(`/workflows/${updated.id}`, payload)
      const saved = normalizeWorkflow(res.data?.data ?? res.data)
      setWorkflows(prev => isNew
        ? [...prev, saved]
        : prev.map(w => w.id === saved.id ? saved : w)
      )
      setEditingWorkflow(null)
    } catch (err) {
      const detail = err.response?.data
      alert(`Opslaan mislukt: ${detail?.message ?? err.message}`)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold text-gray-900" style={{ fontSize: 18 }}>Werkstromen</h2>
          <p className="text-sm text-gray-400 mt-0.5">{workflows.length} werkstromen actief</p>
        </div>
        <button
          onClick={() => setEditingWorkflow({ name: 'Nieuwe Workflow', trigger: 'Dagelijks 08:00', status: 'draft', last_run: null, steps: [] })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ background: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={15} />
          Nieuwe Workflow
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {workflows.map(wf => (
          <WorkflowCard
            key={wf.id}
            workflow={wf}
            onRun={handleRun}
            onEdit={() => setEditingWorkflow(wf)}
          />
        ))}
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