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
import { X, Save, Play, Zap, List, Clock, Workflow as WorkflowIcon, History, FlaskConical, GitBranch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { scheduleLabel } from './ScheduleModal'
import { StopRunButton } from './runControl'
import type { ScheduleConfig } from '@/types/workflow'
import ChangelogPopover from '@/components/drawer/ChangelogPopover'
import EntityChangelog from '@/components/drawer/EntityChangelog'
import type { Id } from '@/types/common'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import QuickViewToggle from '@/components/ui/QuickViewToggle'
import Spinner from '@/components/ui/Spinner'

// Top-level editor view: the node diagram, this workflow's run history, or its
// parent/child relations (WF-RELATIONS-FE-1).
export type EditorView = 'diagram' | 'history' | 'relations'

// The builder's presentational top toolbar: name, diagram/history/relations view tabs, schedule/status/run controls — all state lives in useWorkflowEditor.
export default function WorkflowEditorHeader({
  workflowId,
  name, onNameChange,
  view, onViewChange,
  trigger, scheduleConfig, onOpenSchedule,
  status, onToggleStatus,
  showLogs, onToggleLogs,
  runError, onRunError, runConflict,
  liveRunActive, activeRunId, onStopped,
  running, onRun, onRunDryRun,
  saved, onSave, onSaveClose,
  onClose,
}: {
  // Undefined for a brand-new, not-yet-saved workflow — the changelog icon then
  // has nothing to look up and stays hidden (§3A(d) still just an icon, never a tab).
  workflowId?: Id
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
  // WF-DRYRUN-FE-1: the "Proefdraaien" action next to Run — stages the honest
  // confirm dialog before actually starting the dry run (the confirm itself
  // lives in the editor composer, which owns `useConfirm`).
  onRunDryRun: () => void
  saved: boolean
  onSave: () => void
  onSaveClose: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('workflows')

  // View tabs — node diagram / run history / relations (Make-style). Relations
  // only for a SAVED workflow (mirrors the changelog icon's own guard below).
  const viewTabs: Array<{ id: EditorView; label: string; Icon: typeof WorkflowIcon }> = [
    { id: 'diagram', label: t('editor.tabDiagram'), Icon: WorkflowIcon },
    { id: 'history', label: t('editor.tabHistory'), Icon: History },
    ...(workflowId !== undefined ? [{ id: 'relations' as const, label: t('editor.tabRelations'), Icon: GitBranch }] : []),
  ]

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
        {/* §3A(d): record history is a changelog icon-popover in the title row, never a tab. */}
        {workflowId !== undefined && (
          <ChangelogPopover><EntityChangelog subjectType="Workflow" subjectId={workflowId} /></ChangelogPopover>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* View tabs — node diagram vs. run history (Make-style) */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--hover-bg)', borderRadius: 8, padding: 2, flexShrink: 0 }}>
        {/* Make-style elevated-pill tab (active = resting-card lift via boxShadow),
            a TAB not an action: neither Button (no shadow-lift face) nor the
            shared DrawerTabs (underline style, no per-tab icon) model this look
            — genuine necessity, not scope. Block form: the flagged `style` prop
            sits several lines into this multi-line opening tag, past where
            eslint-disable-next-line reaches. */}
        {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
        {viewTabs.map(v => (
          <button key={v.id} onClick={() => onViewChange(v.id)}
            aria-pressed={view === v.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6,
              fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: view === v.id ? 'var(--surface)' : 'transparent',
              color:      view === v.id ? 'var(--text)'    : 'var(--text-muted)',
              // HUISSTIJL-1: active-tab lift — resting-card role.
              boxShadow:  view === v.id ? 'var(--shadow-card)' : 'none',
            }}>
            <v.Icon size={13} />
            {v.label}
          </button>
        ))}
        {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}
      </div>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      <Button variant="secondary" size="sm" onClick={onOpenSchedule}>
        <Clock size={13} color="var(--text-muted)" />
        {scheduleLabel(t, i18n.language, trigger, scheduleConfig)}
      </Button>

      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* BUG 5: the view tabs beside this already carry aria-pressed — this toggle
          didn't, so a screen reader announced it as a plain button with no on/off state. */}
      {/* A colour-carrying status BADGE (dot + Actief/Inactief), not a Button-tone
          action — the exact "kleurdragende tint-actie zonder Button-tone" exception
          (§4); Toggle's switch semantics would also break this test's own
          aria-pressed contract (BUG 5), which is the deliberate a11y fix here.
          Block form: the flagged `style` prop sits several lines into this
          multi-line opening tag, past where eslint-disable-next-line reaches. */}
      {/* eslint-disable huisstijlLegacy/no-restricted-syntax */}
      <button onClick={onToggleStatus} aria-pressed={status === 'active'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
          background: status === 'active' ? 'var(--color-success-bg)' : 'var(--hover-bg)',
          color:      status === 'active' ? 'var(--color-on-success-bg)' : 'var(--text-muted)',
          border:     `1px solid ${status === 'active' ? 'var(--color-success)' : 'var(--border)'}`,
          cursor: 'pointer', fontSize: 11, fontWeight: 500,
        }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status === 'active' ? 'var(--color-success)' : 'var(--border)' }} />
        {status === 'active' ? t('status.active') : t('status.inactive')}
      </button>
      {/* eslint-enable huisstijlLegacy/no-restricted-syntax */}

      <div style={{ flex: 1 }} />

      {/* PRIMAIR-VLAK-1: a plain-accent toolbar toggle (no distinct semantic
          colour) reads the house trio while ON — QuickViewToggle's default
          `color` branch does exactly that. */}
      {view === 'diagram' && (
        <QuickViewToggle active={showLogs} onToggle={onToggleLogs} label={t('editor.logs')} icon={List} />
      )}

      {/* Run feedback: the backend reason (e.g. a draft can't run) or generic.
          flexShrink 0: the packed header otherwise crushes the message to "D…".
          BUG 5: `role="alert"` (implicit aria-live="assertive") so a screen-reader
          user actually hears the failure — it used to sit in a bare span. */}
      {runError !== null && (
        // eslint-disable-next-line no-restricted-syntax -- DATA: exact-match fallback for var(--color-danger-text), not an ad-hoc colour
        <span role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text, #B91C1C)', maxWidth: 220, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={runError || t('common:actionFailed')}>
          {runError || t('common:actionFailed')}
        </span>
      )}

      {/* RUN-CONTROL-1 single-flight: 409 → "loopt al" + the viewer points at that run.
          Same un-announced-span issue as runError above (BUG 5) — `role="status"`
          (aria-live="polite") since this is informational, not a hard failure. */}
      {runConflict && (
        <span role="status" style={{ fontSize: 11, color: 'var(--color-warning-text)', maxWidth: 220, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={t('runControl.alreadyRunning')}>
          {t('runControl.alreadyRunning')}
        </span>
      )}

      {/* Stop the live run (RUN-CONTROL-1) — visible while it can still be cancelled. */}
      {liveRunActive && activeRunId != null && (
        <StopRunButton runId={activeRunId} onStopped={onStopped} onError={onRunError} />
      )}

      {/* WF-DRYRUN-FE-1: "Proefdraaien" — same single-flight `running` guard as the
          real Run button (only one run at a time regardless of which triggered it);
          the honest confirm before it actually fires lives in the composer. */}
      <Button variant="secondary" size="sm" onClick={onRunDryRun} disabled={running} title={t('editor.dryRunTitle')}>
        {running ? <Spinner size={13} /> : <FlaskConical size={13} />}
        {running ? t('editor.dryRunning') : t('editor.dryRun')}
      </Button>

      <Button variant="primary" size="sm" onClick={onRun} disabled={running}>
        {running ? <Spinner size={13} /> : <Play size={13} />}
        {running ? t('editor.running') : t('editor.run')}
      </Button>

      {/* Opslaan — blijft in editor. §4's "aan/gelukt" token pair (never
          re-approximated per screen) lives in the shared SaveButton. */}
      <SaveButton variant="secondary" size="sm" saved={saved} onClick={onSave}>
        <Save size={13} />
        {saved ? t('editor.saved') : t('editor.save')}
      </SaveButton>

      {/* Opslaan & sluiten — terug naar overzicht (live-run guard eerst) */}
      <Button variant="primary" size="sm" onClick={onSaveClose}>
        <Save size={13} />
        {t('editor.saveClose')}
      </Button>

      <Button variant="secondary" size="sm" iconOnly onClick={onClose}
        aria-label={t('common:close')} title={t('editor.closeTitle')}>
        <X size={15} />
      </Button>
    </div>
  )
}
