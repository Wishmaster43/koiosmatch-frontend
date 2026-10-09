/**
 * RunDetailDrawer — RUN-CONTROL-1 polish wave: this Make-style bundle inspector
 * stays read-only otherwise, but a still-live (running/waiting) run gets the
 * shared StopRunButton, and cancelling it refreshes the drawer immediately
 * instead of waiting out the 3s poll tick. i18n IS initialised here so
 * t() returns translated text (mirrors configPanelWaWeb.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/workflow-runs/5/cancel', undefined,
      expect.objectContaining({ baseURL: 'http://engine.test/api', headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) })))
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

// D2 audit fix: the run-id timeline row uses the shared CopyIconButton, not a
// raw <button> excused with an "out of scope" lint suppression (the ceiling counts that literal).
describe('RunDetailDrawer — run id copy control', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
    vi.mocked(api.post).mockReset()
  })

  it('copies the run id to the clipboard via the shared CopyIconButton', async () => {
    // userEvent.setup() installs its own in-memory clipboard stub (jsdom ships
    // none) — spy AFTER setup so the spy wraps that stub (mirrors CopyIconButton.test.tsx).
    const user = userEvent.setup()
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    render(
      <I18nextProvider i18n={i18n}>
        <RunDetailDrawer run={{ ...baseRun, status: 'success' }} onClose={() => {}} />
      </I18nextProvider>,
    )
    const copyButton = screen.getByRole('button', { name: 'Klik om het ID te kopiëren' })
    await user.click(copyButton)
    expect(writeTextSpy).toHaveBeenCalledWith('5')
  })
})

describe('RunDetailDrawer — blocked run (F7)', () => {
  it("shows the capped step's sentence from its `error` field in the warning callout", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RunDetailDrawer
          run={{ ...baseRun, status: 'blocked', step_results: [{ status: 'skipped', error: 'Shiftmanager-limiet bereikt (500/dag)' }] } as RunRow}
          onClose={() => {}}
        />
      </I18nextProvider>,
    )
    expect(screen.getAllByText('Shiftmanager-limiet bereikt (500/dag)').length).toBeGreaterThanOrEqual(1)
  })
})

// RUN-SKIPPED-REASON-FE-1 (N-006, additive): a run-level `reason` renders as a
// muted line under the status when present, and is absent when it is not.
describe('RunDetailDrawer — RUN-SKIPPED-REASON-FE-1 run-level reason', () => {
  it('renders the reason line when the run carries one', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RunDetailDrawer run={{ ...baseRun, status: 'skipped', reason: 'Geen kandidaten in de selectie' }} onClose={() => {}} />
      </I18nextProvider>,
    )
    expect(screen.getByText('Reden: Geen kandidaten in de selectie')).toBeInTheDocument()
  })

  it('renders nothing extra when the run carries no reason', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RunDetailDrawer run={{ ...baseRun, status: 'success' }} onClose={() => {}} />
      </I18nextProvider>,
    )
    expect(screen.queryByText(/^Reden:/)).not.toBeInTheDocument()
  })

  it('renders the reason line in danger color for a failed run', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RunDetailDrawer run={{ ...baseRun, status: 'failed', reason: 'Workflow gestopt door limiet' }} onClose={() => {}} />
      </I18nextProvider>,
    )
    const line = screen.getByText('Reden: Workflow gestopt door limiet')
    expect(line).toHaveStyle({ color: 'var(--color-danger-text)' })
  })
})

// RUN-REASON-I18N-1: a run-level `reason` that is a known contract CODE
// renders as its translated sentence, never the raw code.
describe('RunDetailDrawer — RUN-REASON-I18N-1 translated reason code', () => {
  it('shows the translated sentence for a known reason code, not the code itself', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <RunDetailDrawer run={{ ...baseRun, status: 'skipped', reason: 'rejected_stage' }} onClose={() => {}} />
      </I18nextProvider>,
    )
    expect(screen.getByText('Reden: Sollicitatie is afgewezen')).toBeInTheDocument()
    expect(screen.queryByText(/rejected_stage/)).not.toBeInTheDocument()
  })
})
