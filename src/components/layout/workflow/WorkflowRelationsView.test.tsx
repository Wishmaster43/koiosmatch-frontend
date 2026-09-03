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

  // Regression (verifier findings 1+2): the toggle must visually flip on the
  // row it was clicked from — not just fire the PUT — whether that row came
  // from the served `tree` or from the K-254 `called_by` list.
  it('flips a tree-node toggle visually, not just the PUT call', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [], children: [{ id: 'c1', name: 'Kindflow', status: 'active' }],
      tree: { id: 'wf-1', name: 'Root', status: 'active', children: [
        { id: 'c1', name: 'Kindflow', status: 'active', children: [] },
      ] },
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/workflows/c1', { status: 'inactive', active: false }))
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  // WF-RELATIONS-FIX-1 regression: the server always sends BOTH `parents` (rich:
  // runs_count/last_run_at/last_run_status) and `called_by` (the same calling
  // workflows, stripped) — this is the only shape the real API returns. The
  // rich row must win, and an id present only in `called_by` still appears.
  it('prefers the rich parents row over the stripped called_by row for the same id, and still shows a called_by-only id', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [{ id: 'p1', name: 'Ouderflow', status: 'active', runs_count: 7, last_run_at: '2026-08-20T10:00:00Z', last_run_status: 'success' }],
      called_by: [
        { id: 'p1', name: 'Ouderflow', status: 'active' },
        { id: 'p2', name: 'Tweede ouder', status: 'inactive' },
      ],
      children: [],
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    // Run stats only exist on the rich `parents` row — a stripped called_by hit
    // would render "0 uitvoeringen" and no last-run status badge.
    expect(await screen.findByText('7 uitvoeringen')).toBeInTheDocument()
    expect(screen.getByText('Geslaagd')).toBeInTheDocument()
    expect(screen.getByText('Tweede ouder')).toBeInTheDocument()
  })

  it('flips a called_by row toggle visually (the default K-254 parents path)', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [], called_by: [{ id: 'p9', name: 'Beller', status: 'active' }], children: [],
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    const toggle = await screen.findByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/workflows/p9', { status: 'inactive', active: false }))
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})

// WF-WACHTRIJ-FE-1: the queue badge per related workflow (K-171) — only ever
// renders when there is something in the queue, never a noisy "0".
// K-254: the recursive tree now comes fully served in ONE response (`tree`,
// server-built, max depth 5) — no more lazy per-node fetch. A failing relation
// still carries the visible warning marker, a cycle still renders the loop
// marker instead of an expander, and a truncated node shows a caption instead
// of recursing further.
describe('WorkflowRelationsView · recursive tree', () => {
  it('renders the warning marker on a child whose last run failed', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [],
      children: [{ id: 'c1', name: 'Kindflow', status: 'active', last_run_status: 'failed' }],
      tree: { id: 'wf-1', name: 'Root', status: 'active', children: [
        { id: 'c1', name: 'Kindflow', status: 'active', children: [] },
      ] },
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(await screen.findByRole('img', { name: 'Laatste run mislukt' })).toBeInTheDocument()
  })

  it('a served tree renders its nested grandchild in a single fetch', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [],
      children: [{ id: 'c1', name: 'Kindflow', status: 'active' }],
      tree: { id: 'wf-1', name: 'Root', status: 'active', children: [
        { id: 'c1', name: 'Kindflow', status: 'active', children: [
          { id: 'g1', name: 'Kleinkindflow', status: 'active', children: [] },
        ] },
      ] },
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Onderliggende workflows tonen' }))
    expect(await screen.findByText('Kleinkindflow')).toBeInTheDocument()
    // ONE relations fetch total — the whole tree came served, no per-node call
    // (other GETs may still fire for the per-row queue badge, unrelated to the tree).
    expect(mockedGet.mock.calls.filter(c => c[0] === '/workflows/wf-1/relations')).toHaveLength(1)
    expect(mockedGet).not.toHaveBeenCalledWith('/workflows/c1/relations')
    expect(mockedGet).not.toHaveBeenCalledWith('/workflows/g1/relations')
  })

  it('a cycle back to an ancestor renders the loop marker, never an expander', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [],
      children: [{ id: 'c1', name: 'Kindflow', status: 'active' }],
      tree: { id: 'wf-1', name: 'Root', status: 'active', children: [
        { id: 'c1', name: 'Kindflow', status: 'active', children: [
          { id: 'wf-1', name: 'Rootflow', status: 'active', cycle: true, children: [] },
        ] },
      ] },
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Onderliggende workflows tonen' }))
    expect(await screen.findByRole('img', { name: 'Deze workflow zit al in deze tak (lus)' })).toBeInTheDocument()
    // The looping row offers NO further expander (one expander total: the outer child's, now collapsed-state toggled).
    expect(screen.getAllByRole('button', { name: /Onderliggende workflows/ })).toHaveLength(1)
  })

  it('a truncated node shows a caption instead of recursing further', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [],
      children: [{ id: 'c1', name: 'Kindflow', status: 'active' }],
      tree: { id: 'wf-1', name: 'Root', status: 'active', children: [
        { id: 'c1', name: 'Kindflow', status: 'active', truncated: true, children: [] },
      ] },
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    await screen.findByText('Kindflow')
    expect(screen.getByText('Al hierboven getoond')).toBeInTheDocument()
  })

  it('shows the call mode chip next to a node the workflow itself calls', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [],
      children: [{ id: 'c1', name: 'Kindflow', status: 'active' }],
      calls: [{ id: 'c1', name: 'Kindflow', status: 'active', mode: 'sync' }],
      tree: { id: 'wf-1', name: 'Root', status: 'active', children: [
        { id: 'c1', name: 'Kindflow', status: 'active', children: [] },
      ] },
    } })
    render(<WorkflowRelationsView workflowId="wf-1" />)
    expect(await screen.findByText('direct')).toBeInTheDocument()
  })
})

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
