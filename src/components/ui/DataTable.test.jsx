import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable from './DataTable'

const columns = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'city', header: 'City' },
]
const rows = [
  { id: 1, name: 'Bob', city: 'Rotterdam' },
  { id: 2, name: 'Ann', city: 'Amsterdam' },
]

describe('DataTable', () => {
  it('renders every row by default (virtualization off unless opted in)', () => {
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Ann')).toBeInTheDocument()
  })

  it('shows the empty text when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyText="Niets gevonden" />)
    expect(screen.getByText('Niets gevonden')).toBeInTheDocument()
  })

  it('sorts ascending on a sortable header click', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} rows={rows} />)
    await user.click(screen.getByText('Name'))
    const bodyRows = screen.getAllByRole('row').slice(1) // drop the header row
    expect(within(bodyRows[0]).getByText('Ann')).toBeInTheDocument()
  })

  it('calls onRowClick with the clicked row', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />)
    await user.click(screen.getByText('Bob'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  it('shows a header + skeleton-row shell while loading, not a layout-jumping spinner block', () => {
    render(<DataTable columns={columns} rows={[]} loading loadingText="Laden…" />)
    // The header stays put — no chrome collapse during loading.
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('City')).toBeInTheDocument()
    // No row data or empty-state text is rendered yet.
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    expect(screen.queryByText('noResults')).not.toBeInTheDocument()
    // The loading text is still available to assistive tech via the table caption.
    expect(screen.getByText('Laden…')).toBeInTheDocument()
  })

  // Job 1 (2026-07-16): a sticky column paints its OWN background on top of the
  // <tr>'s background (to hide horizontally-scrolled content underneath), so a
  // selected/checked row must use the exact same background value for both — a
  // translucent token painted on both would double-composite into a visibly
  // different colour for the sticky cell (regression guard for the "name looks a
  // different colour when selected" bug).
  it('gives the sticky cell the exact same background as the rest of a selected row', () => {
    const stickyColumns = [
      { key: 'name', header: 'Name', sticky: true, width: 120 },
      { key: 'city', header: 'City' },
    ]
    render(<DataTable columns={stickyColumns} rows={rows} selectedId={1} />)
    const bodyRows = screen.getAllByRole('row').slice(1)
    const selectedRow = bodyRows[0]
    const stickyCell = selectedRow.querySelector('td[data-sticky]')
    expect(selectedRow.getAttribute('style')).toMatch(/background:\s*color-mix\(in srgb, var\(--color-primary\) 12%, var\(--bg\)\)/)
    expect(stickyCell.getAttribute('style')).toMatch(/background:\s*color-mix\(in srgb, var\(--color-primary\) 12%, var\(--bg\)\)/)
  })
})
