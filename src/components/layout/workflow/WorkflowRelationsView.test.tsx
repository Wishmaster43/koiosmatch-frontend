/**
 * WorkflowRelationsView — the editor's RELATIES tab (WF-RELATIONS-FE-1): four
 * UI states (loading/error/empty/success) plus the active toggle wired to
 * useWorkflowRelations.toggleStatus. GET-url pinning + toggle-payload pinning
 * live in useWorkflowRelations.test.ts; this covers the view's own rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorkflowRelationsView from './WorkflowRelationsView'
import api from '@/lib/api'

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), put: vi.fn().mockResolvedValue({}) } }
})
const mockedGet = vi.mocked(api.get)

beforeEach(() => vi.clearAllMocks())

describe('WorkflowRelationsView', () => {
  // Real i18next runs in this file's import graph (mirrors WorkflowsPage's own
  // deeplink test) — assertions target the real nl copy, not raw keys.
  it('shows the loading state while the tree is fetching', () => {
    mockedGet.mockReturnValue(new Promise(() => {}))
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(screen.getByText('Relaties ophalen…')).toBeInTheDocument()
  })

  it('shows an honest error (with retry) on a failed fetch, never a blank/empty read', async () => {
    mockedGet.mockRejectedValue(new Error('down'))
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(await screen.findByText('Relaties laden mislukt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Probeer opnieuw/ })).toBeInTheDocument()
  })

  it('shows the honest empty line per section when a workflow has neither parents nor children', async () => {
    mockedGet.mockResolvedValue({ data: { parents: [], children: [] } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(await screen.findByText('Geen bovenliggende workflows')).toBeInTheDocument()
    expect(screen.getByText('Geen onderliggende workflows')).toBeInTheDocument()
  })

  it('renders a parent row with its name, status pill and run count', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [{ id: 'p1', name: 'Ouderflow', status: 'active', runs_count: 4, last_run_status: 'success' }],
      children: [],
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(await screen.findByText('Ouderflow')).toBeInTheDocument()
    expect(screen.getByText('Actief')).toBeInTheDocument()
    expect(screen.getByText('4 uitvoeringen')).toBeInTheDocument()
  })

  it('the active toggle calls the workflow update mutation for that row', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [{ id: 'p1', name: 'Ouderflow', status: 'active' }], children: [],
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/workflows/p1', { status: 'inactive', active: false }))
  })
})

// WF-WACHTRIJ-FE-1: the queue badge per related workflow (K-171) — only ever
// renders when there is something in the queue, never a noisy "0".
describe('WorkflowRelationsView · queue badge', () => {
  it('renders the queue badge when the related workflow has entries', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/workflows/wf-1/relations') return Promise.resolve({ data: {
        parents: [{ id: 'p1', name: 'Ouderflow', status: 'active' }], children: [],
      } })
      if (url === '/workflows/queue?workflow_id=p1') return Promise.resolve({ data: {
        pending: [{}], waiting: [], scheduled: [], retrying: [], counts: { pending: 1, waiting: 0, scheduled_today: 0, retrying: 0 },
      } })
      return Promise.resolve({ data: {} })
    })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(await screen.findByText('1 in wachtrij')).toBeInTheDocument()
  })

  it('renders NO badge when the related workflow has an empty queue', async () => {
    mockedGet.mockImplementation((url: string) => {
      if (url === '/workflows/wf-1/relations') return Promise.resolve({ data: {
        parents: [{ id: 'p1', name: 'Ouderflow', status: 'active' }], children: [],
      } })
      if (url === '/workflows/queue?workflow_id=p1') return Promise.resolve({ data: {
        pending: [], waiting: [], scheduled: [], retrying: [], counts: { pending: 0, waiting: 0, scheduled_today: 0, retrying: 0 },
      } })
      return Promise.resolve({ data: {} })
    })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    await screen.findByText('Ouderflow')
    expect(screen.queryByText(/in wachtrij/)).not.toBeInTheDocument()
  })
})
