/**
 * WorkflowEditorHeader — the builder's fixed top toolbar: workflow name, the
 * diagram/history view tabs, the schedule button, the active/inactive toggle and
 * the right-hand run/save/close cluster (incl. the run-error, single-flight
 * conflict and stop-run feedback).
 *
 * Split off WorkflowCanvasEditor (§3) because it is the one self-contained
 * SECTION of that screen: ~150 lines of pure chrome with no state of its own.
 * Everything it shows arrives as props and every control reports upward, so the
 * editor keeps all state in `useWorkflowEditor` and this file stays presentational.
 */
import { X, Save, Play, Loader2, Zap, List, Clock, Workflow as WorkflowIcon, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { scheduleLabel } from './ScheduleModal'
import { StopRunButton } from './runControl'
import type { ScheduleConfig } from '@/types/workflow'

// Top-level editor view: the node diagram, or this workflow's run history.
export type EditorView = 'diagram' | 'history'

export default function WorkflowEditorHeader({
  name, onNameChange,
  view, onViewChange,
  trigger, scheduleConfig, onOpenSchedule,
  status, onToggleStatus,
  showLogs, onToggleLogs,
  runError, onRunError, runConflict,
  liveRunActive, activeRunId, onStopped,
  running, onRun,
  saved, onSave, onSaveClose,
  onClose,
}: {
  // Optional like `Workflow.name` itself — a brand-new workflow can still be nameless.
  name?: string
  onNameChange: (name: string) => void
  view: EditorView
  onViewChange: (view: EditorView) => void
  // Trigger + schedule are read-only here; editing happens in the ScheduleModal.
  trigger?: string
  scheduleConfig: ScheduleConfig | null
  onOpenSchedule: () => void
  status: string
  onToggleStatus: () => void
  showLogs: boolean
  onToggleLogs: () => void
  // Run feedback surfaced next to the controls that caused it.
  runError: string | null
  onRunError: (message: string) => void
  runConflict: boolean
  liveRunActive: boolean
  activeRunId: string | number | null
  onStopped: () => void
  running: boolean
  onRun: () => void
  saved: boolean
  onSave: () => void
  onSaveClose: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('workflows')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      height: 56, padding: '0 20px', flexShrink: 0,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--color-primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Zap size={15} color="var(--color-primary)" />
        </div>
        {/* The workflow name is edited in place, with no visible label anywhere in the
            header — sighted users read it from its position and weight. A screen reader
            gets nothing from either, so it carries its own name. No existing key fit:
            `canvas.routeName`, `ai.field.name` and `fields.itemName` each name a
            different field, and reusing one would announce the wrong thing. */}
        <input
          value={name} onChange={e => onNameChange(e.target.value)}
          aria-label={t('editor.nameAriaLabel')}
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', border: 'none', background: 'transparent', outline: 'none', minWidth: 60, maxWidth: 240 }}
        />
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* View tabs — node diagram vs. run history (Make-style) */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--hover-bg)', borderRadius: 8, padding: 2, flexShrink: 0 }}>
        {([
          { id: 'diagram', label: t('editor.tabDiagram'), Icon: WorkflowIcon },
          { id: 'history', label: t('editor.tabHistory'), Icon: History },
        ] as const).map(v => (
          <button key={v.id} onClick={() => onViewChange(v.id)}
            aria-pressed={view === v.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6,
              fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: view === v.id ? 'var(--surface)' : 'transparent',
              color:      view === v.id ? 'var(--text)'    : 'var(--text-muted)',
              boxShadow:  view === v.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}>
            <v.Icon size={13} />
            {v.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      <button onClick={onOpenSchedule}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--hover-bg)', cursor: 'pointer',
          fontSize: 12, color: 'var(--text)', fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--hover-bg)')}>
        <Clock size={13} color="var(--text-muted)" />
        {scheduleLabel(t, i18n.language, trigger, scheduleConfig)}
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* BUG 5: the view tabs beside this already carry aria-pressed — this toggle
          didn't, so a screen reader announced it as a plain button with no on/off state. */}
      <button onClick={onToggleStatus} aria-pressed={status === 'active'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
          background: status === 'active' ? 'var(--color-success-bg)' : 'var(--hover-bg)',
          color:      status === 'active' ? 'var(--color-success)' : 'var(--text-muted)',
          border:     `1px solid ${status === 'active' ? 'color-mix(in srgb, var(--color-success) 40%, transparent)' : 'var(--border)'}`,
          cursor: 'pointer', fontSize: 11, fontWeight: 500,
        }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? 'var(--color-success)' : 'var(--border)' }} />
        {status === 'active' ? t('status.active') : t('status.inactive')}
      </button>

      <div style={{ flex: 1 }} />

      {view === 'diagram' && (
        <button onClick={onToggleLogs}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: showLogs ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
            color:      showLogs ? 'var(--color-primary)'    : 'var(--text-muted)',
            border:     `1px solid ${showLogs ? 'var(--color-primary)' : 'var(--border)'}`,
            cursor: 'pointer',
          }}>
          <List size={13} />
          {t('editor.logs')}
        </button>
      )}

      {/* Run feedback: the backend reason (e.g. a draft can't run) or generic.
          flexShrink 0: the packed header otherwise crushes the message to "D…".
          BUG 5: `role="alert"` (implicit aria-live="assertive") so a screen-reader
          user actually hears the failure — it used to sit in a bare span. */}
      {runError !== null && (
        // eslint-disable-next-line no-restricted-syntax -- DATA: exact-match fallback for var(--color-danger), not an ad-hoc colour
        <span role="alert" style={{ fontSize: 11, color: 'var(--color-danger, #DC2626)', maxWidth: 220, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={runError || t('common:actionFailed')}>
          {runError || t('common:actionFailed')}
        </span>
      )}

      {/* RUN-CONTROL-1 single-flight: 409 → "loopt al" + the viewer points at that run.
          Same un-announced-span issue as runError above (BUG 5) — `role="status"`
          (aria-live="polite") since this is informational, not a hard failure. */}
      {runConflict && (
        <span role="status" style={{ fontSize: 11, color: 'var(--color-warning)', maxWidth: 220, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={t('runControl.alreadyRunning')}>
          {t('runControl.alreadyRunning')}
        </span>
      )}

      {/* Stop the live run (RUN-CONTROL-1) — visible while it can still be cancelled. */}
      {liveRunActive && activeRunId != null && (
        <StopRunButton runId={activeRunId} onStopped={onStopped} onError={onRunError} />
      )}

      <button onClick={onRun} disabled={running}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: running ? 'var(--border)' : 'var(--color-primary-bg)',
          color:      running ? 'var(--text-muted)' : 'var(--color-primary)',
          border: 'none', cursor: running ? 'not-allowed' : 'pointer',
        }}>
        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {running ? t('editor.running') : t('editor.run')}
      </button>

      {/* Opslaan — blijft in editor */}
      <button onClick={onSave}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: saved ? 'var(--color-success-bg)' : 'var(--hover-bg)',
          color: saved ? 'var(--color-success)' : 'var(--text)',
          border: `1px solid ${saved ? 'var(--color-success)' : 'var(--border)'}`,
          cursor: 'pointer', transition: 'background 0.2s',
        }}>
        <Save size={13} />
        {saved ? t('editor.saved') : t('editor.save')}
      </button>

      {/* Opslaan & sluiten — terug naar overzicht (live-run guard eerst) */}
      <button onClick={onSaveClose}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: 'var(--color-primary)', color: 'white',
          border: 'none', cursor: 'pointer',
        }}>
        <Save size={13} />
        {t('editor.saveClose')}
      </button>

      <button onClick={onClose} aria-label={t('common:close')}
        style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        title={t('editor.closeTitle')}>
        <X size={15} />
      </button>
    </div>
  )
}
