/**
 * RunLineage — WF-RELATIONS-FE-1's run-detail lineage: the call chain
 * (root-first, each entry linkable into that workflow's editor) plus the
 * specific parent run id. Read tolerantly from either `run.context.*` or
 * promoted top-level fields — both shapes are pinned here. Renders nothing
 * for a root-level run (no parent), the honest empty case.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunLineage from './RunLineage'
import type { RunRow } from '@/types/reports'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? k, i18n: { language: 'nl' } })
  }
})

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
    const run: RunRow = { id: 4, parent_run_id: 'r-parent-2', call_chain: ['a1b2c3d4-e5f6-47a8-9abc-1234567890ab'] }
    render(<RunLineage run={run} />)
    // A bare id with no resolvable name renders as a short chip (first 8
    // chars), never the full uuid (RUN-LINEAGE-CONTRACT-1).
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument()
    expect(screen.queryByText('a1b2c3d4-e5f6-47a8-9abc-1234567890ab')).not.toBeInTheDocument()
    expect(screen.getByText(/r-parent-2/)).toBeInTheDocument()
  })

  // WF-RELATIONS-FIX-1: call_chain is id-only from the server — a caller can
  // resolve names via a map built from data it already has (e.g. a runs list).
  it('resolves an id-only call_chain entry through the workflowNames map', () => {
    const run: RunRow = { id: 9, call_chain: ['wf-root'] }
    render(<RunLineage run={run} workflowNames={{ 'wf-root': 'Rootflow' }} />)
    expect(screen.getByText('Rootflow')).toBeInTheDocument()
    expect(screen.queryByText('wf-root')).not.toBeInTheDocument()
  })

  it('falls back to the short id chip when the id is absent from workflowNames too', () => {
    const run: RunRow = { id: 10, call_chain: ['12345678-abcd-ef00-0000-000000000000'] }
    render(<RunLineage run={run} workflowNames={{ 'some-other-id': 'Andereflow' }} />)
    expect(screen.getByText('12345678')).toBeInTheDocument()
    expect(screen.queryByText('12345678-abcd-ef00-0000-000000000000')).not.toBeInTheDocument()
  })

  it('shows the parent run id even with an empty call chain', () => {
    const run: RunRow = { id: 5, context: { parent_run_id: 'r-only' } }
    render(<RunLineage run={run} />)
    expect(screen.getByText(/r-only/)).toBeInTheDocument()
  })

  // K-254 (WF-RELATIONS-FE-2): child_runs list, detail-only field.
  it('renders a status badge + short mono id per child run', () => {
    const run: RunRow = {
      id: 6,
      child_runs: [{ id: 'abcdef1234567890', workflow_id: 'wf-child', status: 'completed' }],
    }
    render(<RunLineage run={run} />)
    expect(screen.getByText('runs.drawer.childRuns')).toBeInTheDocument()
    expect(screen.getByText('abcdef12')).toBeInTheDocument()
  })

  it('a root-level run WITH child runs still renders (not the honest-empty case)', () => {
    const run: RunRow = { id: 7, child_runs: [{ id: 'child-1', status: 'running' }] }
    render(<RunLineage run={run} />)
    expect(screen.getByText('runs.drawer.childRuns')).toBeInTheDocument()
  })

  it('a root-level run with NO parent and NO child runs still renders nothing', () => {
    const { container } = render(<RunLineage run={{ id: 8, child_runs: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
