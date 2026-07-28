/**
 * CustomersTable — regression test for the audit fix: the `search` state used
 * to have no setter and no input control feeding it (a "control that goes
 * nowhere" in reverse — dead state, unreachable filter branch). This asserts
 * the search box is now rendered and actually narrows the visible rows.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import CustomersTable from './CustomersTable'
import type { ReportCustomer } from '@/types/reports'

const customers: ReportCustomer[] = [
  { id: 'c1', name: 'Zorgpartners Midden-Holland', debtor_number: 'DEB-1001', status: 'active', account_manager: 'Iris de Wit', locations: [] },
  { id: 'c2', name: 'Amsterdam UMC', debtor_number: 'DEB-1002', status: 'active', account_manager: 'Jan Bakker', locations: [] },
]

// Data layer under test control (mirrors VacanciesReport.test.tsx's convention).
vi.mock('./useReportCustomers', () => ({
  useReportCustomers: () => ({ customers, loading: false, error: false }),
}))
// usePersistedPageSize (PaginationBar) reads the logged-in user's page-size
// preference off AuthContext — stub it the same way the other page tests do.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

describe('CustomersTable — search box wiring', () => {
  it('renders a search input (was missing — the search state had no control)', () => {
    render(<CustomersTable />)
    expect(screen.getByPlaceholderText('Zoek op naam, debiteurnummer, accountmanager…')).toBeInTheDocument()
  })

  it('shows every customer before typing', () => {
    render(<CustomersTable />)
    expect(screen.getByText('Zorgpartners Midden-Holland')).toBeInTheDocument()
    expect(screen.getByText('Amsterdam UMC')).toBeInTheDocument()
  })

  it('typing in the search box narrows the visible rows', () => {
    render(<CustomersTable />)
    const input = screen.getByPlaceholderText('Zoek op naam, debiteurnummer, accountmanager…')
    fireEvent.change(input, { target: { value: 'Amsterdam' } })
    expect(screen.getByText('Amsterdam UMC')).toBeInTheDocument()
    expect(screen.queryByText('Zorgpartners Midden-Holland')).not.toBeInTheDocument()
  })
})

// Accessibility regression (2026-07-28): this table's headers were a mouse-only
// `<th onClick>` with no keyboard path and no aria-sort. It keeps its own
// hand-rolled markup (client-side pagination sorts the FULL filtered list before
// slicing a page — adopting the shared DataTable, which owns sort state
// internally, would only reorder rows within the current page), so the fix adds
// a real <button> + aria-sort around the existing header, mirroring DataTable.
describe('CustomersTable — keyboard-accessible sort headers', () => {
  it('sorts the Naam column via a keyboard Enter press and reflects it via aria-sort', async () => {
    const user = userEvent.setup()
    render(<CustomersTable />)

    const header = screen.getByText('Naam').closest('th')
    // Default sort is already Naam/asc, so this exposes the active state up front.
    expect(header).toHaveAttribute('aria-sort', 'ascending')

    const sortButton = screen.getByRole('button', { name: /Naam/ })
    sortButton.focus()
    expect(sortButton).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(header).toHaveAttribute('aria-sort', 'descending')

    // Descending by name: "Zorgpartners…" now sorts before "Amsterdam UMC".
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(within(bodyRows[0]).getByText('Zorgpartners Midden-Holland')).toBeInTheDocument()
  })
})
