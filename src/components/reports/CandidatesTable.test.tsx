/**
 * CandidatesTable (components/reports) — regression test for the 2026-07-28
 * accessibility fix: sortable column headers used to be a mouse-only
 * `<th onClick>` with no keyboard path and no aria-sort. Converting to the
 * shared DataTable (§3A) gives every sortable header a real, keyboard-operable
 * button whose aria-sort reflects the current sort — asserted end-to-end
 * through this table's own columns.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import CandidatesTable from './CandidatesTable'
import type { ReportCandidate } from '@/types/reports'

// Both rows carry status 'actief' — the component's uncontrolled default filter.
const candidates: ReportCandidate[] = [
  { id: 'c1', firstname: 'Zara',  lastname: 'Visser', status: 'actief', position: 'Verpleegkundige' },
  { id: 'c2', firstname: 'Anouk', lastname: 'de Boer', status: 'actief', position: 'Verzorgende' },
]

describe('CandidatesTable — keyboard-accessible sort headers (DataTable conversion)', () => {
  it('renders both candidates through the shared DataTable', () => {
    render(<CandidatesTable candidates={candidates} />)
    expect(screen.getByText('Zara Visser')).toBeInTheDocument()
    expect(screen.getByText('Anouk de Boer')).toBeInTheDocument()
  })

  it('sorts the Naam column via a keyboard Enter press and reflects it via aria-sort', async () => {
    const user = userEvent.setup()
    render(<CandidatesTable candidates={candidates} />)

    const header = screen.getByText('Naam').closest('th')
    // Default sort is already Naam/asc, so a fresh Enter press flips it to desc —
    // still proves reachability/activation and that aria-sort tracks the change.
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    const sortButton = screen.getByRole('button', { name: /Naam/ })
    sortButton.focus()
    expect(sortButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-sort', 'descending')

    // Descending by name: "Zara Visser" now sorts before "Anouk de Boer".
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(within(bodyRows[0]).getByText('Zara Visser')).toBeInTheDocument()
  })
})
