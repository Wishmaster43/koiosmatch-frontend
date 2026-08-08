import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable, { shiftRangeIds } from './DataTable'

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

  // Defect fix: a sortable header must be a real <button>, reachable by Tab and
  // operable with Enter/Space, not just a mouse click on the <th>.
  it('sorts on a keyboard Enter press on the sortable header button', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} rows={rows} />)
    const sortButton = screen.getByRole('button', { name: 'Name' })
    sortButton.focus()
    expect(sortButton).toHaveFocus()
    await user.keyboard('{Enter}')
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(within(bodyRows[0]).getByText('Ann')).toBeInTheDocument()
  })

  it('sorts on a keyboard Space press on the sortable header button', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} rows={rows} />)
    const sortButton = screen.getByRole('button', { name: 'Name' })
    sortButton.focus()
    await user.keyboard(' ')
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(within(bodyRows[0]).getByText('Ann')).toBeInTheDocument()
  })

  it('reflects the active sort column/direction via aria-sort and defaults the rest to none', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} rows={rows} />)
    const nameHeader = screen.getByText('Name').closest('th')
    // Not sorted yet: still exposes aria-sort="none" so a screen-reader user can
    // tell this IS a sortable column, just not the active one.
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('exposes no button and no aria-sort on a non-sortable header', () => {
    render(<DataTable columns={columns} rows={rows} />)
    const cityHeader = screen.getByText('City').closest('th')
    expect(cityHeader).not.toHaveAttribute('aria-sort')
    expect(within(cityHeader).queryByRole('button')).not.toBeInTheDocument()
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

// Job 43 — the pure range helper, tested directly (no rendering needed).
describe('shiftRangeIds', () => {
  it('returns just the target when there is no anchor yet', () => {
    expect(shiftRangeIds([1, 2, 3], null, 2)).toEqual([2])
  })

  it('returns the inclusive range forward (anchor before target)', () => {
    expect(shiftRangeIds([1, 2, 3, 4, 5], 2, 5)).toEqual([2, 3, 4, 5])
  })

  it('returns the inclusive range backward (anchor after target) in page order', () => {
    expect(shiftRangeIds([1, 2, 3, 4, 5], 5, 2)).toEqual([2, 3, 4, 5])
  })

  it('returns just the target when the anchor id is stale (no longer on the page)', () => {
    expect(shiftRangeIds([1, 2, 3], 99, 2)).toEqual([2])
  })

  it('returns just the target when anchor and target are the same row', () => {
    expect(shiftRangeIds([1, 2, 3], 2, 2)).toEqual([2])
  })
})

// Job 43 — shift-click range selection wired end-to-end. A tiny stateful wrapper
// mirrors how a real caller (useCandidateBulkActions' toggleRow) owns `selectedIds`,
// since the range logic reads back the CURRENT selection to decide select vs deselect.
function SelectableTable({ rows: initialRows, initialSelected = [] }) {
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelected))
  const onToggleRow = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  return <DataTable columns={columns} rows={initialRows} selectable selectedIds={selectedIds} onToggleRow={onToggleRow} />
}

describe('DataTable · shift-click range selection (job 43)', () => {
  const fiveRows = [1, 2, 3, 4, 5].map(id => ({ id, name: `Row ${id}`, city: 'X' }))

  it('selects the whole range between the last click and a shift-click', () => {
    render(<SelectableTable rows={fiveRows} />)
    const boxes = screen.getAllByLabelText('selectRow')
    fireEvent.click(boxes[1])                          // plain click on row 2 → anchor = row 2
    fireEvent.click(boxes[4], { shiftKey: true })       // shift-click row 5 → range 2..5 selected
    expect(boxes[0]).not.toBeChecked() // row 1, outside the range
    expect(boxes[1]).toBeChecked()
    expect(boxes[2]).toBeChecked()
    expect(boxes[3]).toBeChecked()
    expect(boxes[4]).toBeChecked()
  })

  it('deselects the range when the shift-clicked target is currently checked', () => {
    render(<SelectableTable rows={fiveRows} initialSelected={[2, 3, 4, 5]} />)
    const boxes = screen.getAllByLabelText('selectRow')
    fireEvent.click(boxes[4], { shiftKey: true })       // anchor is unset yet → row 5 alone toggles off
    expect(boxes[4]).not.toBeChecked()
    fireEvent.click(boxes[1])                            // plain click row 2 (already checked) → unchecks it, anchor = row 2
    expect(boxes[1]).not.toBeChecked()
    fireEvent.click(boxes[3], { shiftKey: true })         // shift-click row 4 (still checked) → deselect range 2..4
    expect(boxes[1]).not.toBeChecked()
    expect(boxes[2]).not.toBeChecked()
    expect(boxes[3]).not.toBeChecked()
  })
})

// DATATABLE-SORT-1 — the additive controlled-sort escape hatch. Both new props
// are optional; the tests below prove (a) the escape hatch works when opted
// into and (b) the other 36+ consumers that never pass it stay byte-identical.
function ControlledTable({ initialSort = null }) {
  const [sort, setSort] = useState(initialSort)
  return <DataTable columns={columns} rows={rows} sort={sort} onSortChange={setSort} />
}

describe('DataTable · controlled sort (DATATABLE-SORT-1)', () => {
  it('calls onSortChange with the FE column key on header click, and does NOT resort on its own until the caller feeds the new sort back', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<DataTable columns={columns} rows={rows} sort={null} onSortChange={onSortChange} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(onSortChange).toHaveBeenCalledWith({ by: 'name', dir: 'asc' })
    // The caller (this test) never echoed the new sort back via the `sort` prop —
    // a controlled component must not silently mutate its own display, so the
    // original row order is still showing (Bob before Ann).
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(within(bodyRows[0]).getByText('Bob')).toBeInTheDocument()
  })

  it('round-trips through a stateful caller exactly like the uncontrolled table: click → asc, click again → desc', async () => {
    const user = userEvent.setup()
    render(<ControlledTable />)
    const nameHeader = screen.getByText('Name').closest('th')
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(within(screen.getAllByRole('row')[1]).getByText('Ann')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    expect(within(screen.getAllByRole('row')[1]).getByText('Bob')).toBeInTheDocument()
  })

  // Regression guard: a table that passes NEITHER prop must behave exactly as
  // it did before this feature existed — internal state, no callback ever fired.
  it('leaves the uncontrolled path untouched when sort/onSortChange are both omitted', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<DataTable columns={columns} rows={rows} />)
    await user.click(screen.getByRole('button', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(onSortChange).not.toHaveBeenCalled() // never wired, so it can never fire
    const nameHeader = screen.getByText('Name').closest('th')
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    expect(within(screen.getAllByRole('row')[1]).getByText('Bob')).toBeInTheDocument()
  })
})

// Unknown sort values (null/undefined) must sink to the bottom in BOTH directions.
// Reversing the whole sorted array floated "not computed yet" vacancies above the
// vacancy with the most real leads on the descending click (audit 2026-07-27).
describe('DataTable · unknown sort values', () => {
  const cols = [
    { key: 'title', header: 'Titel' },
    { key: 'count', header: 'Aantal', sortable: true, sortValue: r => r.count },
  ]
  const rows = [
    { id: 1, title: 'A', count: null },
    { id: 2, title: 'B', count: 3 },
    { id: 3, title: 'C', count: 1 },
  ]
  const titles = () => Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent)

  it('sorts unknown rows last ascending AND descending', () => {
    render(<DataTable columns={cols} rows={rows} />)
    const header = screen.getByText('Aantal').closest('th')
    fireEvent.click(within(header).getByRole('button'))   // ascending
    expect(titles()).toEqual(['C', 'B', 'A'])
    fireEvent.click(within(header).getByRole('button'))   // descending
    expect(titles()).toEqual(['B', 'C', 'A'])
  })
})
