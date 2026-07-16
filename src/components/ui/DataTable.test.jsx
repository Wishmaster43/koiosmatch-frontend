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
