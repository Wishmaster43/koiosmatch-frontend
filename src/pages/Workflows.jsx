import { useState } from 'react'
import {
  Zap, Users, Calendar, MessageCircle, Database,
  Mail, Clock, Play, Plus, MoreHorizontal,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react'
import WorkflowEditor from '../components/layout/WorkflowEditor'

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

export default function WorkflowsPage() {
  const [workflows, setWorkflows]       = useState(MOCK_WORKFLOWS)
  const [editingWorkflow, setEditingWorkflow] = useState(null)

  const handleRun = async (id) => {
    console.log('Workflow uitvoeren:', id)
    return new Promise(r => setTimeout(r, 1500))
  }

  const handleSave = (updated) => {
    setWorkflows(prev => prev.map(w => w.id === updated.id ? updated : w))
    setEditingWorkflow(null)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold text-gray-900" style={{ fontSize: 18 }}>Werkstromen</h2>
          <p className="text-sm text-gray-400 mt-0.5">{workflows.length} werkstromen actief</p>
        </div>
        <button
          onClick={() => setEditingWorkflow({ id: Date.now(), name: 'Nieuwe werkstroom', trigger: 'Dagelijks 08:00', status: 'draft', last_run: null, steps: [] })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ background: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}
        >
          <Plus size={15} />
          Nieuwe werkstroom
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
        <WorkflowEditor
          workflow={editingWorkflow}
          onClose={() => setEditingWorkflow(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}