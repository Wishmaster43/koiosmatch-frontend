/**
 * RunsTable — regression test for the 2026-07-28 accessibility fix: sortable
 * column headers used to be a mouse-only `<th onClick>` with no keyboard path
 * and no aria-sort. Converting to the shared DataTable (§3A) gives every
 * sortable header a real, keyboard-operable button whose aria-sort reflects
 * the current sort — asserted end-to-end through this table's own columns.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import RunsTable, { getWorkflowIdFromHash } from './RunsTable'
import { useReportList } from './useReportList'
import type { RunRow } from '@/types/reports'

const runs: RunRow[] = [
  { id: 'r1', workflow_name: 'Welkomstflow', status: 'success', started_at: '2026-07-01T10:00:00Z', duration_ms: 1200, candidates_count: 5 },
  { id: 'r2', workflow_name: 'Herinneringsflow', status: 'failed', started_at: '2026-07-02T10:00:00Z', duration_ms: 800, candidates_count: 2 },
]

// Data layer under test control (mirrors the other report-table tests) — a spy
// so WEBHOOK-RUN-CORRELATION-1's request-url assertions can inspect its call args.
vi.mock('./useReportList', () => ({
  useReportList: vi.fn(() => ({ rows: runs, loading: false, error: false })),
}))

// Panel spy: captures the registered group set so the range pin can drive its callbacks.
const registerFilters = vi.fn()
vi.mock('@/context/RightPanelContext', () => ({
  useRightPanel: () => ({ registerFilters, unregisterFilters: vi.fn() }),
}))
const lastRegisteredGroups = () => registerFilters.mock.calls.at(-1)?.[1] ?? []

afterEach(() => { window.location.hash = '' })

describe('RunsTable — keyboard-accessible sort headers (DataTable conversion)', () => {
  it('renders both runs through the shared DataTable', () => {
    render(<RunsTable />)
    expect(screen.getByText('Welkomstflow')).toBeInTheDocument()
    expect(screen.getByText('Herinneringsflow')).toBeInTheDocument()
  })

  it('sorts the Workflow column via a keyboard Enter press and reflects it via aria-sort', async () => {
    const user = userEvent.setup()
    render(<RunsTable />)

    const header = screen.getByText('Workflow').closest('th')
    // Not sorted yet: still exposes aria-sort="none" so a screen-reader user can
    // tell this IS a sortable column, just not the active one.
    expect(header).toHaveAttribute('aria-sort', 'none')

    const sortButton = screen.getByRole('button', { name: /Workflow/ })
    sortButton.focus()
    expect(sortButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    // Ascending by workflow name: "Herinneringsflow" sorts before "Welkomstflow".
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(within(bodyRows[0]).getByText('Herinneringsflow')).toBeInTheDocument()
  })
})

describe('getWorkflowIdFromHash — pure helper', () => {
  it('reads workflow_id out of the hash query string', () => {
    expect(getWorkflowIdFromHash('#details.runs?workflow_id=42')).toBe('42')
  })

  it('returns null when there is no query string', () => {
    expect(getWorkflowIdFromHash('#details.runs')).toBeNull()
  })

  it('returns null when workflow_id is absent from the query string', () => {
    expect(getWorkflowIdFromHash('#details.runs?view=list')).toBeNull()
  })
})

describe('RunsTable — WEBHOOK-RUN-CORRELATION-1 workflow_id filter', () => {
  // A WorkflowRefs link lands here as `#details.runs?workflow_id=<id>` — the
  // request must carry that id as the server-side query param.
  it('requests /workflow-runs?workflow_id=<id> when the hash carries a filter', () => {
    window.location.hash = '#details.runs?workflow_id=42'
    render(<RunsTable />)
    expect(vi.mocked(useReportList)).toHaveBeenCalledWith('/workflow-runs?workflow_id=42', expect.any(String))
  })

  // No filter in the hash: the plain, unfiltered endpoint (unchanged behaviour).
  it('requests the plain /workflow-runs endpoint when the hash carries no filter', () => {
    render(<RunsTable />)
    expect(vi.mocked(useReportList)).toHaveBeenCalledWith('/workflow-runs', expect.any(String))
  })

  // Time window (slotstuk, server contract 53fe3bb0): picking from/to in the
  // registered date-range group must reach the REQUEST as from/to params.
  it('requests /workflow-runs with from/to when the range group is set', async () => {
    render(<RunsTable />)
    const groups = lastRegisteredGroups()
    const range = groups.find((g: { key: string }) => g.key === 'runRange') as
      { onFromChange: (v: string) => void; onToChange: (v: string) => void }
    expect(range).toBeDefined()
    act(() => range.onFromChange('2026-08-01'))
    act(() => range.onToChange('2026-08-28'))
    await waitFor(() => expect(vi.mocked(useReportList))
      .toHaveBeenCalledWith('/workflow-runs?from=2026-08-01&to=2026-08-28', expect.any(String)))
  })
})

// audit r2-ui-states-2: a failed load must read as an error, never as "no runs yet".
describe('RunsTable — failed load is an error state', () => {
  it('shows the load error copy and not the empty copy when the hook reports an error', () => {
    vi.mocked(useReportList).mockReturnValueOnce({ rows: [], loading: false, error: true })
    render(<RunsTable />)
    expect(screen.getByText('Kon uitvoeringen niet laden.')).toBeInTheDocument()
    expect(screen.queryByText('Geen uitvoeringen gevonden')).toBeNull()
  })
})

describe('RunsTable — WFB-14 status filter goes server-side through the display→API map', () => {
  // Picking the display status "success" must forward the backend's real enum
  // value 'completed' (RunPresenter maps completed -> 'success' for display) —
  // sending 'success' verbatim would 422 against the API's `in:` rule.
  it('requests /workflow-runs?status=completed when "success" is picked', async () => {
    render(<RunsTable />)
    const groups = lastRegisteredGroups()
    const status = groups.find((g: { key: string }) => g.key === 'status') as
      { onToggle: (v: string) => void }
    expect(status).toBeDefined()
    act(() => status.onToggle('success'))
    await waitFor(() => expect(vi.mocked(useReportList))
      .toHaveBeenCalledWith('/workflow-runs?status=completed', expect.any(String)))
  })

  // A status whose display value already matches the API enum (e.g. 'failed')
  // passes through unchanged.
  it('requests /workflow-runs?status=failed when "failed" is picked', async () => {
    render(<RunsTable />)
    const groups = lastRegisteredGroups()
    const status = groups.find((g: { key: string }) => g.key === 'status') as
      { onToggle: (v: string) => void }
    act(() => status.onToggle('failed'))
    await waitFor(() => expect(vi.mocked(useReportList))
      .toHaveBeenCalledWith('/workflow-runs?status=failed', expect.any(String)))
  })
})

describe('RunsTable — WFB-14 (c) the status filter cannot trap itself', () => {
  // The verifier's finding: deriving `statusOptions` from the RETURNED rows
  // means a status pick that yields zero rows on the server empties the option
  // list, which unregisters the whole "status" group — the filter then
  // disappears from the panel while the stale selection keeps riding every
  // request, with no way back short of a reload. Options must come from the
  // fixed vocabulary instead, so the group survives a zero-row response.
  it('keeps the status group registered with all six options, even when the current page has zero runs', () => {
    vi.mocked(useReportList).mockReturnValueOnce({ rows: [], loading: false, error: false })
    render(<RunsTable />)
    const groups = lastRegisteredGroups()
    const status = groups.find((g: { key: string }) => g.key === 'status') as
      { options: { value: string }[] } | undefined
    expect(status).toBeDefined()
    expect(status?.options.map(o => o.value).sort()).toEqual(
      ['blocked', 'cancelled', 'failed', 'running', 'success', 'waiting'],
    )
  })

  // Picking a second status must still be possible — proves the multi-select
  // branch (comment at :64-67) is reachable, not dead code behind a collapsed
  // one-entry option list.
  it('lets a second status be picked after the first (multi-select stays reachable)', async () => {
    render(<RunsTable />)
    const groups = lastRegisteredGroups()
    const status = groups.find((g: { key: string }) => g.key === 'status') as
      { onToggle: (v: string) => void; options: { value: string }[] }
    act(() => status.onToggle('success'))
    await waitFor(() => expect(vi.mocked(useReportList))
      .toHaveBeenCalledWith('/workflow-runs?status=completed', expect.any(String)))

    const groupsAfter = lastRegisteredGroups()
    const statusAfter = groupsAfter.find((g: { key: string }) => g.key === 'status') as
      { options: { value: string }[] }
    // The option list is still the full fixed vocabulary, not collapsed to one.
    expect(statusAfter.options.length).toBe(6)
  })
})

// LIMITS-FE-F7: 'blocked' (a run halted by a connector limit, WorkflowRun::STATUSES)
// joins the fixed status vocabulary and forwards verbatim (already an API enum value).
describe('RunsTable — LIMITS-FE-F7 blocked status', () => {
  it('requests /workflow-runs?status=blocked when "blocked" is picked', async () => {
    render(<RunsTable />)
    const groups = lastRegisteredGroups()
    const status = groups.find((g: { key: string }) => g.key === 'status') as
      { onToggle: (v: string) => void }
    act(() => status.onToggle('blocked'))
    await waitFor(() => expect(vi.mocked(useReportList))
      .toHaveBeenCalledWith('/workflow-runs?status=blocked', expect.any(String)))
  })

  it('renders the blocked badge with the block reason as its title, read from the capped step (not error_message, which the BE never populates for blocked runs)', () => {
    vi.mocked(useReportList).mockReturnValueOnce({
      rows: [{
        id: 'r3', workflow_name: 'Limietflow', status: 'blocked',
        step_results: [{ status: 'skipped', message: 'Limiet bereikt (sm, modus block) — stap overgeslagen, niets gesynchroniseerd.' }],
      }],
      loading: false, error: false,
    })
    render(<RunsTable />)
    expect(screen.getByText('Geblokkeerd').closest('span'))
      .toHaveAttribute('title', 'Limiet bereikt (sm, modus block) — stap overgeslagen, niets gesynchroniseerd.')
  })
})
