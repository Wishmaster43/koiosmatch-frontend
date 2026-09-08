/**
 * RunDetailDrawer — RUN-CONTROL-1 polish wave: this Make-style bundle inspector
 * stays read-only otherwise, but a still-live (running/waiting) run gets the
 * shared StopRunButton, and cancelling it refreshes the drawer immediately
 * instead of waiting out the 3s poll tick. i18n IS initialised here so
 * t() returns translated text (mirrors configPanelWaWeb.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
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
    vi.unstubAllEnvs()
  })

  it('shows the stop button for a RUNNING run', () => {
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'running' }} onClose={() => {}} />
    </I18nextProvider>,
  )
    // i18n is initialized; the key translates to Dutch "Stoppen"
    expect(screen.getByText('Stoppen')).toBeInTheDocument()
  })

  it('shows the stop button for a WAITING run too', () => {
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'waiting' }} onClose={() => {}} />
    </I18nextProvider>,
  )
    // i18n is initialized; the key translates to Dutch "Stoppen"
    expect(screen.getByText('Stoppen')).toBeInTheDocument()
  })

  it('hides the stop button for a finished (success) run', () => {
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'success' }} onClose={() => {}} />
    </I18nextProvider>,
  )
    expect(screen.queryByText('Stoppen')).not.toBeInTheDocument()
  })

  it('hides the stop button for an already-cancelled run', () => {
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'cancelled' }} onClose={() => {}} />
    </I18nextProvider>,
  )
    expect(screen.queryByText('Stoppen')).not.toBeInTheDocument()
  })

  it('cancels the run and refreshes immediately — the button disappears once the refetch shows it stopped', async () => {
    // K-3: pin the EXACT resolved base URL on this test — the other requests
    // asserted in this file stay expect.any(String) (route/body is what they cover).
    vi.stubEnv('VITE_WORKFLOW_API_URL', 'http://engine.test/api')
    vi.mocked(api.post).mockResolvedValue({})
    vi.mocked(api.get).mockResolvedValue({ data: [{ ...baseRun, status: 'cancelled' }] })
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'running' }} onClose={() => {}} />
    </I18nextProvider>,
  )

    fireEvent.click(screen.getByText('Stoppen'))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/workflow-runs/5/cancel', undefined, { baseURL: 'http://engine.test/api' }))
    // Refresh-after-cancel: fetched right away, not on the next 3s poll tick.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflows/10/runs', { baseURL: 'http://engine.test/api' }))
    await waitFor(() => expect(screen.queryByText('Stoppen')).not.toBeInTheDocument())
  })

  it('surfaces the backend reason inline when the cancel fails (e.g. already finished)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { message: 'Run is al klaar' } } })
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'running' }} onClose={() => {}} />
    </I18nextProvider>,
  )

    fireEvent.click(screen.getByText('Stoppen'))
    expect(await screen.findByText('Run is al klaar')).toBeInTheDocument()
  })
})

// K-254 (WF-RELATIONS-FE-2): the run DETAIL fetch, once per open.
describe('RunDetailDrawer — run detail fetch', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('requests GET /workflow-runs/{id} once when opened', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 5, child_runs: [] } })
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'success' }} onClose={() => {}} />
    </I18nextProvider>,
  )
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workflow-runs/5', { baseURL: expect.any(String) }))
    expect(vi.mocked(api.get).mock.calls.filter(c => c[0] === '/workflow-runs/5')).toHaveLength(1)
  })

  it('merges the fetched child_runs into the run shown to RunLineage', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { id: 5, child_runs: [{ id: 'child-1', status: 'completed' }] } })
    render(
    <I18nextProvider i18n={i18n}>
      <RunDetailDrawer run={{ ...baseRun, status: 'success' }} onClose={() => {}} />
    </I18nextProvider>,
  )
    // i18n is initialized; the key translates to Dutch "Kind-runs"
    expect(await screen.findByText('Kind-runs')).toBeInTheDocument()
  })
})
