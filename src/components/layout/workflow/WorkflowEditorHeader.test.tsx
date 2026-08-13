/**
 * WorkflowEditorHeader — a11y regression tests (BUG 5). Real i18n is NOT
 * initialized in this test's import graph (mirrors ScheduleModal.test.tsx), so
 * `t()` returns the raw key — assertions target roles/attributes, not text.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorkflowEditorHeader from './WorkflowEditorHeader'

// EntityChangelog pulls in lib/datetime → src/i18n (which self-initializes real
// i18next as a module side effect) — stubbed out here so this file's "raw key"
// assumption (see docblock) keeps holding. None of these tests pass `workflowId`,
// so the real component would never render anyway (see the icon's own guard).
vi.mock('@/components/drawer/EntityChangelog', () => ({ default: () => null }))

// Every prop the header needs; each test overrides only what it cares about.
const baseProps = {
  name: 'My workflow',
  onNameChange: vi.fn(),
  view: 'diagram' as const,
  onViewChange: vi.fn(),
  trigger: 'Handmatig',
  scheduleConfig: null,
  onOpenSchedule: vi.fn(),
  status: 'inactive',
  onToggleStatus: vi.fn(),
  showLogs: false,
  onToggleLogs: vi.fn(),
  runError: null,
  onRunError: vi.fn(),
  runConflict: false,
  liveRunActive: false,
  activeRunId: null,
  onStopped: vi.fn(),
  running: false,
  onRun: vi.fn(),
  saved: false,
  onSave: vi.fn(),
  onSaveClose: vi.fn(),
  onClose: vi.fn(),
}

describe('WorkflowEditorHeader · a11y (BUG 5)', () => {
  it('the active/inactive toggle reports its state via aria-pressed, like the diagram/history tabs beside it', () => {
    const { rerender } = render(<WorkflowEditorHeader {...baseProps} status="inactive" />)
    expect(screen.getByText('status.inactive').closest('button')).toHaveAttribute('aria-pressed', 'false')

    rerender(<WorkflowEditorHeader {...baseProps} status="active" />)
    expect(screen.getByText('status.active').closest('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('a run error is announced (role="alert"), not a silent bare span', () => {
    render(<WorkflowEditorHeader {...baseProps} runError="Draft workflows cannot run" />)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Draft workflows cannot run')
  })

  it('a single-flight run conflict is announced (role="status"), not a silent bare span', () => {
    render(<WorkflowEditorHeader {...baseProps} runConflict />)
    expect(screen.getByRole('status')).toHaveTextContent('runControl.alreadyRunning')
  })
})
