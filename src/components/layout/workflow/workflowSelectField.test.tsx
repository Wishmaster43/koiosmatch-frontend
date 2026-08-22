/**
 * WorkflowSelectField (WF-MODULE-RECONCILE-FE-1) — the workflow_call module's
 * `workflow_id` picker. Asserts the searchable list is fed by GET /workflows
 * (never a hardcoded list, §3A), archived workflows are excluded, and picking
 * an option writes the workflow's id into the config via onChange. Mirrors
 * lookupSelectValueKey.test.tsx's mocking technique (partial mock: only the
 * transport is faked, unwrapList stays real).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkflowSelectField } from './fieldControls'
import { FieldInput } from './fields'

vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: vi.fn().mockResolvedValue({ data: [
    { id: 'wf-1', name: 'Heractivering', archived: false },
    { id: 'wf-2', name: 'Oude flow (gearchiveerd)', archived: true },
  ] }) },
}))

describe('WorkflowSelectField', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists workflows from GET /workflows and writes the picked id into the config', async () => {
    const onChange = vi.fn()
    render(<WorkflowSelectField value={undefined} onChange={onChange} fieldKey="workflow_id" />)
    fireEvent.click(await screen.findByRole('button'))
    const opt = await screen.findByText('Heractivering')
    // Pin the ROUTE, not just the payload — the mock answers any URL, so without
    // this the endpoint could silently drift (§13: touch the seam).
    const api = (await import('@/lib/api')).default
    expect(api.get).toHaveBeenCalledWith('/workflows')
    fireEvent.click(opt)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('workflow_id', 'wf-1'))
  })

  it('excludes archived workflows from the picker', async () => {
    const onChange = vi.fn()
    render(<WorkflowSelectField value={undefined} onChange={onChange} fieldKey="workflow_id" />)
    fireEvent.click(await screen.findByRole('button'))
    await screen.findByText('Heractivering')
    expect(screen.queryByText('Oude flow (gearchiveerd)')).not.toBeInTheDocument()
  })
})

describe('FieldInput · schema type "workflow"', () => {
  beforeEach(() => vi.clearAllMocks())

  it('dispatches field.type "workflow" to the searchable workflow picker', async () => {
    const onChange = vi.fn()
    render(<FieldInput field={{ key: 'workflow_id', label: 'Workflow', type: 'workflow' }} value={undefined} onChange={onChange} />)
    fireEvent.click(await screen.findByRole('button'))
    const opt = await screen.findByText('Heractivering')
    fireEvent.click(opt)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('workflow_id', 'wf-1'))
  })
})
