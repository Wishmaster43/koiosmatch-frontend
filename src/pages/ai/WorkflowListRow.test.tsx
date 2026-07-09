import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkflowListRow from './WorkflowListRow'
import type { Workflow } from '@/types/workflow'

// Guards the Make.com-style row: the whole row opens the editor, while the
// toggle/run/menu controls stop propagation so they don't also fire it (AW-list).
const baseWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Welcome flow',
  status: 'active',
  trigger_type: 'scheduled',
  steps: [{ type: 'webhook' }, { type: 'candidates' }, { type: 'email_send' }, { type: 'delay' }],
  last_run: { time: '2026-07-08T10:00:00Z', ok: true },
  updated_at: '2026-07-08T09:00:00Z',
}

describe('WorkflowListRow', () => {
  it('opens the editor when the row itself is clicked', () => {
    const onEdit = vi.fn()
    render(<WorkflowListRow workflow={baseWorkflow} onRun={vi.fn()} onEdit={onEdit} onToggleStatus={vi.fn()} />)
    fireEvent.click(screen.getByText('Welcome flow'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('the status toggle flips status without opening the editor (stopPropagation)', () => {
    const onEdit = vi.fn()
    const onToggleStatus = vi.fn()
    render(<WorkflowListRow workflow={baseWorkflow} onRun={vi.fn()} onEdit={onEdit} onToggleStatus={onToggleStatus} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggleStatus).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('the run button runs without opening the editor (stopPropagation)', () => {
    const onEdit = vi.fn()
    const onRun = vi.fn()
    render(<WorkflowListRow workflow={baseWorkflow} onRun={onRun} onEdit={onEdit} onToggleStatus={vi.fn()} />)
    // Real i18n is active here (WorkflowListRow pulls in useDateFormat → src/i18n); default language is nl.
    fireEvent.click(screen.getByRole('button', { name: 'Uitvoeren' }))
    expect(onRun).toHaveBeenCalledWith('wf-1')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('the "…" menu does not double-fire onEdit via bubbling (stopPropagation)', () => {
    const onEdit = vi.fn()
    render(<WorkflowListRow workflow={baseWorkflow} onRun={vi.fn()} onEdit={onEdit} onToggleStatus={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Workflow bewerken'))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('shows a "+N" overflow bubble when there are more than 3 steps', () => {
    render(<WorkflowListRow workflow={baseWorkflow} onRun={vi.fn()} onEdit={vi.fn()} onToggleStatus={vi.fn()} />)
    // 4 steps → 2 visible + one overflow bubble ("+2")
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('falls back to a single generic bubble when the workflow has no steps yet', () => {
    render(<WorkflowListRow workflow={{ ...baseWorkflow, steps: [] }} onRun={vi.fn()} onEdit={vi.fn()} onToggleStatus={vi.fn()} />)
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
  })
})
