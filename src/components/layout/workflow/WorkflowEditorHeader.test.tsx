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
  onRunDryRun: vi.fn(),
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
    expect(screen.getByText('runControl.alreadyRunning')).toHaveAttribute('role', 'status')
  })
})

// PRIJSMODEL-C 30-08: a budget_exceeded run error carries a staffel-stand
// Caption, and a real Button href ONLY when the server actually gave a
// contact/url — never a fake CTA (§0 no fake affordances).
describe('WorkflowEditorHeader · budget_exceeded upgrade hint (PRIJSMODEL-C)', () => {
  it('shows the budget line but no button when there is no contact/url', () => {
    render(<WorkflowEditorHeader {...baseProps} runError="Workflow-staffel is vol."
      runBudget={{ state: 'blocked', allowance: 100, used: 100, remaining: 0, unit: 'workflow_run' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Workflow-staffel is vol.')
    expect(screen.queryByRole('link', { name: /runControl.upgradeHint/ })).not.toBeInTheDocument()
  })

  it('renders a real link when the upgrade hint carries a contact', () => {
    render(<WorkflowEditorHeader {...baseProps} runError="Workflow-staffel is vol."
      runBudget={{ state: 'blocked', allowance: 100, used: 100, remaining: 0, unit: 'workflow_run',
        upgrade_hint: { next_tier_key: 'pro', next_tier_label: 'Pro', contact: 'mailto:sales@koiosmatch.nl' } }} />)
    const link = screen.getByRole('link', { name: /runControl.upgradeHint/ })
    expect(link).toHaveAttribute('href', 'mailto:sales@koiosmatch.nl')
  })
})

// F4 (ROUTER-EDGE-FILTERS-1/D6): Run/Dry-run must never fire on a non-active
// workflow — disabled up front with an honest i18n title, instead of the raw
// Dutch 422 the server used to be the only source of truth for.
describe('WorkflowEditorHeader · run gated on status (F4)', () => {
  it('disables Run and Dry-run for a draft workflow', () => {
    render(<WorkflowEditorHeader {...baseProps} status="draft" />)
    expect(screen.getByText('editor.run').closest('button')).toBeDisabled()
    expect(screen.getByText('editor.dryRun').closest('button')).toBeDisabled()
  })

  it('enables Run and Dry-run for an active workflow', () => {
    render(<WorkflowEditorHeader {...baseProps} status="active" />)
    expect(screen.getByText('editor.run').closest('button')).not.toBeDisabled()
    expect(screen.getByText('editor.dryRun').closest('button')).not.toBeDisabled()
  })

  // A disabled button shows no tooltip and takes no focus, so the reason must be a
  // visible status line (§3: disabled WITH an honest notice), absent once active.
  it('shows the visible run-gate notice for a draft and hides it when active', () => {
    const { rerender } = render(<WorkflowEditorHeader {...baseProps} status="draft" />)
    expect(screen.getByText('editor.runRequiresActive').closest('[role="status"]')).not.toBeNull()
    rerender(<WorkflowEditorHeader {...baseProps} status="active" />)
    expect(screen.queryByText('editor.runRequiresActive')).toBeNull()
  })
})
