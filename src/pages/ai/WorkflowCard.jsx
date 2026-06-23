/**
 * WorkflowCard — one workflow tile: name, status badge, module-chip row (StepPill +
 * the local MODULE_META lookup), last-run state and run/edit actions. Extracted from
 * WorkflowsPage. (AW-6 follow-up: feed StepPill from the shared module registry.)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Calendar, MessageCircle, Database, Mail, Clock, AlertCircle, CheckCircle, Loader2, MoreHorizontal, Play, Zap } from 'lucide-react'

// Module chip icon + colours; label = t('modules.<type>').
const MODULE_META = {
  candidates: { Icon: Users,         color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  planning:    { Icon: Calendar,      color: '#0F6E56', bg: '#E1F5EE' },
  whatsapp_send:    { Icon: MessageCircle, color: '#3B6D11', bg: '#EAF3DE' },
  database_update:  { Icon: Database,      color: '#185FA5', bg: '#E6F1FB' },
  email_send:       { Icon: Mail,          color: '#854F0B', bg: '#FAEEDA' },
  delay:            { Icon: Clock,         color: '#5F5E5A', bg: '#F1EFE8' },
}

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

export default function WorkflowCard({ workflow, onRun, onEdit }) {
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
