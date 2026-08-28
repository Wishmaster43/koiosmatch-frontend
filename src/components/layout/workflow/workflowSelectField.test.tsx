/**
 * WorkflowSelectField (WF-MODULE-RECONCILE-FE-1) — the workflow_call module's
 * `workflow_id` picker. Asserts the searchable list is fed by GET /workflows
 * (never a hardcoded list, §3A), archived workflows are excluded, picking an
 * option writes the workflow's id into the config via onChange, the workflow
 * being edited excludes ITSELF from the list (WF-PICKER-SELF-1 — the engine
 * hard-fails a self-referencing workflow_call at run time), and a failed GET
 * renders an honest error+retry state rather than the empty-state copy
 * (WF-PICKER-ERROR-1). Mirrors lookupSelectValueKey.test.tsx's mocking
 * technique (partial mock: only the transport is faked, unwrapList stays real).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WorkflowSelectField } from './fieldControls/WorkflowSelectField'
import { FieldInput } from './fields'
import { CurrentWorkflowContext } from './contexts'

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

describe('WorkflowSelectField · WF-PICKER-SELF-1 self-exclusion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('excludes the workflow currently being edited, keeping every other active workflow', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.get).mockResolvedValueOnce({ data: [
      { id: 'wf-1', name: 'Heractivering', archived: false },
      { id: 'wf-2', name: 'Zichzelf aanroepen (huidige workflow)', archived: false },
    ] })
    const onChange = vi.fn()
    render(
      <CurrentWorkflowContext.Provider value="wf-2">
        <WorkflowSelectField value={undefined} onChange={onChange} fieldKey="workflow_id" />
      </CurrentWorkflowContext.Provider>,
    )
    fireEvent.click(await screen.findByRole('button'))
    await screen.findByText('Heractivering')
    expect(screen.queryByText('Zichzelf aanroepen (huidige workflow)')).not.toBeInTheDocument()
  })

  it('excludes nothing when no current workflow id is provided (context default)', async () => {
    const onChange = vi.fn()
    render(<WorkflowSelectField value={undefined} onChange={onChange} fieldKey="workflow_id" />)
    fireEvent.click(await screen.findByRole('button'))
    expect(await screen.findByText('Heractivering')).toBeInTheDocument()
  })
})

describe('WorkflowSelectField · WF-PICKER-ERROR-1 error state', () => {
  beforeEach(() => vi.clearAllMocks())

  // No real i18next instance runs in this file (matches every describe above), so
  // `t('fields.workflowError')` / ErrorBanner's own `t('error.retry')` fall back to
  // their raw keys — the assertions below target those keys, same convention as
  // NotesTab.test.tsx's ConfirmDialog/openSecondScreen cases.
  it('renders an honest error (not the empty-state copy) when GET /workflows fails, and retries on demand', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network down'))
    const onChange = vi.fn()
    render(<WorkflowSelectField value={undefined} onChange={onChange} fieldKey="workflow_id" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('fields.workflowError')
    // The dishonest fallback this replaces (§3 four UI states) must never show.
    expect(screen.queryByText('fields.workflowEmpty')).not.toBeInTheDocument()

    // Recovers on retry once the transport succeeds again.
    fireEvent.click(screen.getByRole('button', { name: 'error.retry' }))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    fireEvent.click(await screen.findByRole('button'))
    expect(await screen.findByText('Heractivering')).toBeInTheDocument()
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
