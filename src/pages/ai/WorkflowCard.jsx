/**
 * WorkflowCard — one workflow tile: name, status badge, module-chip row (StepPill +
 * the shared module registry), last-run state and run/edit actions. Extracted from WorkflowsPage.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle, Loader2, MoreHorizontal, Play, Zap } from 'lucide-react'
import PropTypes from 'prop-types'
// Shared module registry — every module type (label/Icon/colours), so no step chip
// silently disappears (AW-6). The local 6-type map is gone.
import { MODULE_META } from '@/modules/index'

// Status badge colours; label = t('status.<key>').
const STATUS_STYLES = {
  active:   { bg: 'var(--color-success-bg)', color: 'var(--color-success)', dot: 'var(--color-success)' },
  draft:    { bg: 'var(--hover-bg)', color: 'var(--text-muted)', dot: 'var(--text-muted)' },
  inactive: { bg: 'var(--color-warning-bg)', color: '#C2410C', dot: '#F97316' },
}

function StepPill({ type }) {
  const { t } = useTranslation('workflows')
  const meta = MODULE_META[type]
  if (!meta) return null
  const Icon = meta.Icon
  const label = t(`modules.${type}`, { defaultValue: meta.label ?? type })
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

// Compact horizontal row for the list view
export function WorkflowRow({ workflow, onRun, onEdit }) {
  const { t } = useTranslation('workflows')
  const [running, setRunning] = useState(false)
  const status = STATUS_STYLES[workflow.status] || STATUS_STYLES.draft

  const handleRun = async () => {
    setRunning(true)
    await onRun(workflow.id)
    setTimeout(() => setRunning(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)]"
      style={{ borderBottom: '1px solid var(--border)' }}>

      {/* Icon */}
      <div className="flex items-center justify-center flex-shrink-0 rounded-lg"
        style={{ width: 30, height: 30, background: 'var(--color-primary-bg)' }}>
        <Zap size={13} color="var(--color-primary)" />
      </div>

      {/* Name + trigger */}
      <div className="min-w-0" style={{ width: 220, flexShrink: 0 }}>
        <div className="font-medium text-[var(--text)] truncate" style={{ fontSize: 13 }}>{workflow.name}</div>
        <div className="text-xs text-[var(--text-muted)] truncate">{workflow.trigger}</div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 flex-shrink-0"
        style={{ background: status.bg, color: status.color }}>
        <span className="rounded-full" style={{ width: 5, height: 5, background: status.dot }} />
        <span style={{ fontSize: 11, fontWeight: 500 }}>{t(`status.${workflow.status}`, { defaultValue: workflow.status })}</span>
      </div>

      {/* Module chips — max 4 then +N */}
      <div className="flex flex-wrap gap-1 flex-1 min-w-0">
        {workflow.steps.slice(0, 4).map((step, i) => <StepPill key={i} type={step.type} />)}
        {workflow.steps.length > 4 && (
          <span className="text-xs text-[var(--text-muted)] flex items-center">+{workflow.steps.length - 4}</span>
        )}
      </div>

      {/* Last run */}
      <div className="flex items-center gap-1.5 flex-shrink-0" style={{ width: 220 }}>
        {workflow.last_run ? (
          <>
            {workflow.last_run.ok
              ? <CheckCircle size={12} color="var(--color-success)" />
              : <AlertCircle size={12} color="var(--color-danger)" />}
            <span className="text-xs text-[var(--text-muted)] truncate">
              {workflow.last_run.ok
                ? `${workflow.last_run.time} · ${t('page.candidates', { n: workflow.last_run.candidates })}`
                : `${workflow.last_run.time} · ${workflow.last_run.error}`}
            </span>
          </>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">{t('page.notRun')}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={handleRun} disabled={running}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium"
          style={{ background: running ? 'var(--border)' : 'var(--color-primary-bg)', color: running ? 'var(--text-muted)' : 'var(--color-primary)', border: 'none', cursor: running ? 'not-allowed' : 'pointer' }}>
          {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          {running ? t('page.running') : t('page.run')}
        </button>
        <button onClick={onEdit}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 26, height: 26, background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <MoreHorizontal size={13} />
        </button>
      </div>
    </div>
  )
}

WorkflowRow.propTypes = { workflow: PropTypes.object.isRequired, onRun: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired }

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
    <div className="flex flex-col gap-4 p-5 bg-[var(--surface)] rounded-xl" style={{ border: '1px solid var(--border)' }}>

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center min-w-0 gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0 rounded-lg"
            style={{ width: 36, height: 36, background: 'var(--color-primary-bg)' }}
          >
            <Zap size={16} color="var(--color-primary)" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[var(--text)] truncate" style={{ fontSize: 14 }}>
              {workflow.name}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{workflow.trigger}</div>
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

      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--hover-bg)' }}>
        <div className="flex items-center gap-1.5">
          {workflow.last_run ? (
            <>
              {workflow.last_run.ok
                ? <CheckCircle size={13} color="var(--color-success)" />
                : <AlertCircle size={13} color="var(--color-danger)" />
              }
              <span className="text-xs text-[var(--text-muted)]">
                {workflow.last_run.ok
                  ? `${workflow.last_run.time} · ${t('page.candidates', { n: workflow.last_run.candidates })}`
                  : `${workflow.last_run.time} · ${workflow.last_run.error}`
                }
              </span>
            </>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">{t('page.notRun')}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{
              background: running ? 'var(--border)' : 'var(--color-primary-bg)',
              color: running ? 'var(--text-muted)' : 'var(--color-primary)',
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
            style={{ width: 28, height: 28, background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
