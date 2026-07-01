import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import api from '@/lib/api'
import WorkflowHistoryView from './WorkflowHistoryView'

// The history view fetches this workflow's runs on mount → stub the api client.
vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }))

const run = { id: 1, status: 'success', started_at: '2026-06-23T10:00:00Z', trigger: 'manual', duration_ms: 5000 }

describe('WorkflowHistoryView', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('shows the loading state while runs are fetching', async () => {
    // Deferred promise: assert loading, then resolve so the worker settles cleanly.
    let resolve!: (v: unknown) => void
    vi.mocked(api.get).mockReturnValue(new Promise(r => { resolve = r }))
    render(<WorkflowHistoryView workflowId={1} />)
    expect(screen.getByText('runs.loading')).toBeInTheDocument()
    resolve({ data: [] })
    await screen.findByText('runs.editorEmpty')
  })

  it('shows the empty state when there are no runs', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    render(<WorkflowHistoryView workflowId={1} />)
    expect(await screen.findByText('runs.editorEmpty')).toBeInTheDocument()
  })

  it('renders a run row and opens the drawer on click', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [run] })
    render(<WorkflowHistoryView workflowId={1} />)
    const triggerCell = await screen.findByText('manual')
    fireEvent.click(triggerCell)
    expect(await screen.findByText('runs.drawer.timeline')).toBeInTheDocument()
  })
})
