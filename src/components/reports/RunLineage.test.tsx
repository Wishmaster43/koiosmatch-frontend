/**
 * RunLineage — WF-RELATIONS-FE-1's run-detail lineage: the call chain
 * (root-first, each entry linkable into that workflow's editor) plus the
 * specific parent run id. Read tolerantly from either `run.context.*` or
 * promoted top-level fields — both shapes are pinned here. Renders nothing
 * for a root-level run (no parent), the honest empty case.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunLineage from './RunLineage'
import type { RunRow } from '@/types/reports'

describe('RunLineage', () => {
  it('renders nothing for a root-level run (no parent, no chain)', () => {
    const { container } = render(<RunLineage run={{ id: 1 }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the call chain root-first from run.context, each entry linkable', () => {
    const run: RunRow = {
      id: 3,
      context: {
        parent_run_id: 'r-parent',
        parent_workflow_id: 'wf-parent',
        call_chain: [{ id: 'wf-root', name: 'Rootflow' }, { id: 'wf-mid', name: 'Middenflow' }],
      },
    }
    render(<RunLineage run={run} />)
    expect(screen.getByText('Rootflow')).toBeInTheDocument()
    expect(screen.getByText('Middenflow')).toBeInTheDocument()
    // EntityLink's deep-link icon carries the real href into that workflow's editor.
    const link = screen.getByText('Rootflow').closest('span')?.parentElement?.querySelector('a[href*="wf-root"]')
    expect(link).toBeTruthy()
  })

  it('also reads promoted top-level fields (parent_run_id/call_chain not nested under context)', () => {
    const run: RunRow = { id: 4, parent_run_id: 'r-parent-2', call_chain: ['wf-only-id'] }
    render(<RunLineage run={run} />)
    // A bare id (no name) still renders honestly as its own label.
    expect(screen.getByText('wf-only-id')).toBeInTheDocument()
    expect(screen.getByText(/r-parent-2/)).toBeInTheDocument()
  })

  it('shows the parent run id even with an empty call chain', () => {
    const run: RunRow = { id: 5, context: { parent_run_id: 'r-only' } }
    render(<RunLineage run={run} />)
    expect(screen.getByText(/r-only/)).toBeInTheDocument()
  })
})
