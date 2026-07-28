import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Real i18n runtime (mirrors WorkflowListRow.test.tsx) — WorkflowCard has no other
// module in its import graph that pulls it in; assertions below check the actual
// translated nl copy, not raw keys.
import '@/i18n'
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
