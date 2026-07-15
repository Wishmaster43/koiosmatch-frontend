/**
 * RunDetailDrawer — RUN-CONTROL-1 polish wave: this Make-style bundle inspector
 * stays read-only otherwise, but a still-live (running/waiting) run gets the
 * shared StopRunButton, and cancelling it refreshes the drawer immediately
 * instead of waiting out the 3s poll tick. i18n is not initialised in tests, so
 * t() returns the raw key (mirrors RunStepList.test.tsx / WorkflowHistoryView.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import RunDetailDrawer from './RunDetailDrawer'
import type { RunRow } from '@/types/reports'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const baseRun: RunRow = {
  id: 5, workflow_id: 10, workflow_name: 'Welkomstflow', started_at: '2026-07-15T09:00:00Z',
}

describe('RunDetailDrawer — stop button', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('shows the stop button for a RUNNING run', () => {
    render(<RunDetailDrawer run={{ ...baseRun, status: 'running' }} onClose={() => {}} />)
    expect(screen.getByText('runControl.stop')).toBeInTheDocument()
  })

  it('shows the stop button for a WAITING run too', () => {
    render(<RunDetailDrawer run={{ ...baseRun, status: 'waiting' }} onClose={() => {}} />)
    expect(screen.getByText('runControl.stop')).toBeInTheDocument()
  })

  it('hides the stop button for a finished (success) run', () => {
    render(<RunDetailDrawer run={{ ...baseRun, status: 'success' }} onClose={() => {}} />)
    expect(screen.queryByText('runControl.stop')).not.toBeInTheDocument()
  })

  it('hides the stop button for an already-cancelled run', () => {
    render(<RunDetailDrawer run={{ ...baseRun, status: 'cancelled' }} onClose={() => {}} />)
    expect(screen.queryByText('runControl.stop')).not.toBeInTheDocument()
  })

  it('cancels the run and refreshes immediately — the button disappears once the refetch shows it stopped', async () => {
    vi.mocked(api.post).mockResolvedValue({})
    vi.mocked(api.get).mockResolvedValue({ data: [{ ...baseRun, status: 'cancelled' }] })
    render(<RunDetailDrawer run={{ ...baseRun, status: 'running' }} onClose={() => {}} />)

    fireEvent.click(screen.getByText('runControl.stop'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/workflow-runs/5/cancel'))
    // Refresh-after-cancel: fetched right away, not on the next 3s poll tick.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflows/10/runs'))
    await waitFor(() => expect(screen.queryByText('runControl.stop')).not.toBeInTheDocument())
  })

  it('surfaces the backend reason inline when the cancel fails (e.g. already finished)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: 'Run is al klaar' } } })
    render(<RunDetailDrawer run={{ ...baseRun, status: 'running' }} onClose={() => {}} />)

    fireEvent.click(screen.getByText('runControl.stop'))
    expect(await screen.findByText('Run is al klaar')).toBeInTheDocument()
  })
})
