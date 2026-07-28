/**
 * RunsTable — regression test for the 2026-07-28 accessibility fix: sortable
 * column headers used to be a mouse-only `<th onClick>` with no keyboard path
 * and no aria-sort. Converting to the shared DataTable (§3A) gives every
 * sortable header a real, keyboard-operable button whose aria-sort reflects
 * the current sort — asserted end-to-end through this table's own columns.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import RunsTable from './RunsTable'
import type { RunRow } from '@/types/reports'

const runs: RunRow[] = [
  { id: 'r1', workflow_name: 'Welkomstflow', status: 'success', started_at: '2026-07-01T10:00:00Z', duration_ms: 1200, candidates_count: 5 },
  { id: 'r2', workflow_name: 'Herinneringsflow', status: 'failed', started_at: '2026-07-02T10:00:00Z', duration_ms: 800, candidates_count: 2 },
]

// Data layer under test control (mirrors the other report-table tests).
vi.mock('./useReportList', () => ({
  useReportList: () => ({ rows: runs, loading: false }),
}))

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
