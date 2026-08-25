import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
// Real i18n runtime (mirrors WorkflowListRow.test.tsx) — WorkflowCard has no other
// module in its import graph that pulls it in; assertions below check the actual
// translated nl copy, not raw keys. Default-exported so the seeded-name test below
// can switch languages (LOOKUP-I18N-1).
import i18n from '@/i18n'
import WorkflowCard from './WorkflowCard'
import type { Workflow } from '@/types/workflow'

const baseWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Welcome flow',
  status: 'active',
  trigger: 'Handmatig',
  steps: [{ type: 'email_send' }],
  last_run: { time: '2026-07-08T10:00:00Z', ok: true },
}

describe('WorkflowCard', () => {
  // Audit 2026-07-28 (§6 icon-only buttons): the "…" menu button rendered a bare
  // MoreHorizontal icon with no aria-label/title at all — an accessible-name-less
  // control, unlike its sibling in WorkflowListRow which already had one.
  it('exposes an accessible name on the icon-only "…" menu button', () => {
    render(<WorkflowCard workflow={baseWorkflow} onRun={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Workflow bewerken' })).toBeInTheDocument()
  })

  it('opens the editor when the "…" button is clicked, without double-firing via the card click', () => {
    const onEdit = vi.fn()
    render(<WorkflowCard workflow={baseWorkflow} onRun={vi.fn()} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Workflow bewerken' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})

// TRASH-OVERAL-1b grid-parity: the card carries the same archive/restore lifecycle
// as WorkflowListRow (shared gates/handlers, no fork).
describe('WorkflowCard · archived (TRASH-OVERAL-1b)', () => {
  const archivedWorkflow: Workflow = { ...baseWorkflow, archived: true, deleted_at: '2026-08-14T09:00:00Z' }

  it('shows the archived badge and hides the run button', () => {
    render(<WorkflowCard workflow={archivedWorkflow} onRun={vi.fn()} onEdit={vi.fn()}
      canManageFolders onArchive={vi.fn()} onRestore={vi.fn()} />)
    expect(screen.getByText('Gearchiveerd')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Uitvoeren' })).not.toBeInTheDocument()
  })

  it('the restore button calls onRestore without opening the editor, and is hidden without permission', async () => {
    const onEdit = vi.fn()
    const onRestore = vi.fn()
    const { rerender } = render(<WorkflowCard workflow={archivedWorkflow} onRun={vi.fn()} onEdit={onEdit}
      canManageFolders onArchive={vi.fn()} onRestore={onRestore} />)
    await act(async () => { fireEvent.click(screen.getByLabelText('Workflow herstellen')) })
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()

    rerender(<WorkflowCard workflow={archivedWorkflow} onRun={vi.fn()} onEdit={onEdit}
      canManageFolders={false} onArchive={vi.fn()} onRestore={onRestore} />)
    expect(screen.queryByLabelText('Workflow herstellen')).not.toBeInTheDocument()
  })

  it('a live (non-archived) card with permission shows a gated archive action that does not open the editor', () => {
    const onEdit = vi.fn()
    const onArchive = vi.fn()
    render(<WorkflowCard workflow={baseWorkflow} onRun={vi.fn()} onEdit={onEdit}
      canManageFolders onArchive={onArchive} onRestore={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Workflow archiveren'))
    expect(onArchive).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })
})

// LOOKUP-I18N-1 (round 2 pin): a workflow that still carries its seeded Dutch name
// renders in the user language; a tenant rename/creation stays exactly as typed.
describe('WorkflowCard · seeded workflow name i18n (LOOKUP-I18N-1)', () => {
  it('renders a seeded workflow name in English when the UI language is English', async () => {
    await i18n.changeLanguage('en')
    const seededWorkflow: Workflow = { ...baseWorkflow, name: 'Heractivering' }
    const { unmount } = render(<WorkflowCard workflow={seededWorkflow} onRun={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.getByText('Reactivation')).toBeInTheDocument()
    expect(screen.queryByText('Heractivering')).not.toBeInTheDocument()
    // Unmount before switching back — resetting the language on a still-mounted
    // component would fire a state update outside act().
    unmount()
    await i18n.changeLanguage('nl')
  })

  it('leaves a tenant-renamed workflow name untouched under English', async () => {
    await i18n.changeLanguage('en')
    const tenantWorkflow: Workflow = { ...baseWorkflow, name: 'Welcome flow' }
    const { unmount } = render(<WorkflowCard workflow={tenantWorkflow} onRun={vi.fn()} onEdit={vi.fn()} />)
    expect(screen.getByText('Welcome flow')).toBeInTheDocument()
    unmount()
    await i18n.changeLanguage('nl')
  })
})
