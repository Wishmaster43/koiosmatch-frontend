import { useState, useEffect } from 'react'
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

  // Heraudit r3 HIGH regression: the row is keyboard-operable — Enter/Space fire
  // onRowClick via interactiveRow (native row role kept, no role="button").
  it('opens a row with Enter and Space, and only when clickable', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const { unmount } = render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />)
    const row = screen.getByText('Bob').closest('tr')
    expect(row).toHaveAttribute('tabindex', '0')
    row.focus()
    await user.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
    await user.keyboard(' ')
    expect(onRowClick).toHaveBeenCalledTimes(2)
    unmount()
    // Without onRowClick the row must stay inert — never focusable.
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.getByText('Bob').closest('tr')).not.toHaveAttribute('tabindex')
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

// SELECT-RACE-1: the header select-all checkbox goes inert while the caller's
// list query is fetching a fresh server result — the disabled state itself
// (guard (c) pins the race-clear behaviour below, this pins the prop wiring).
describe('DataTable · selectionBusy (SELECT-RACE-1)', () => {
  it('disables the header select-all checkbox (and marks it aria-disabled) when selectionBusy is true', () => {
    render(<DataTable columns={columns} rows={rows} selectable selectedIds={new Set()}
      onToggleRow={() => {}} onToggleAll={() => {}} selectionBusy />)
    const selectAll = screen.getByLabelText('selectAll')
    expect(selectAll).toBeDisabled()
    expect(selectAll).toHaveAttribute('aria-disabled', 'true')
  })

  it('leaves the header checkbox enabled and plain when selectionBusy is omitted (byte-identical for every existing caller)', () => {
    render(<DataTable columns={columns} rows={rows} selectable selectedIds={new Set()}
      onToggleRow={() => {}} onToggleAll={() => {}} />)
    const selectAll = screen.getByLabelText('selectAll')
    expect(selectAll).not.toBeDisabled()
    expect(selectAll).not.toHaveAttribute('aria-disabled')
  })
})

// SELECT-RACE-1: reproduces Danny's screenshot — a select-all made against the
// CURRENT rows, then the rows are swapped for a NEW server result (a bumped
// "epoch") while some but not all ids overlap. This mirrors the real fix: each
// useXData hook bumps rowsEpoch only when its list query's fetch actually
// resolves (never on a local optimistic setQueryData write), and each page
// clears selectedIds in an effect keyed on that epoch — reproduced here with a
// tiny stateful wrapper standing in for a page + its data hook.
function RaceTable({ rowsA, rowsB }) {
  const [epoch, setEpoch] = useState(0)
  const [activeRows, setActiveRows] = useState(rowsA)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const onToggleAll = (ids, allSelected) => setSelectedIds(allSelected ? new Set() : new Set(ids))
  const onToggleRow = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  // The house fix: clear selection only when the epoch changes (a NEW server
  // result landing) — the exact `useEffect(() => setSelectedIds(new Set()), [rowsEpoch])`
  // pattern every entity page now carries.
  useEffect(() => { setSelectedIds(new Set()) }, [epoch])
  // Test-only trigger standing in for "the ~4s fetch resolves": swaps in rows B
  // and bumps the epoch together, exactly like a query's data replacing the
  // page's rows the instant its fetch completes.
  const swapToNewEpoch = () => { setActiveRows(rowsB); setEpoch(e => e + 1) }
  // Test-only trigger standing in for an optimistic bulk mutation (setRows
  // inside a bulk action): a NEW array reference, same ids, no epoch bump —
  // the CRITICAL GUARD this whole design hinges on.
  const mutateOptimistically = () => setActiveRows(prev => prev.map(r => ({ ...r, name: `${r.name}*` })))
  return (
    <>
      <button onClick={swapToNewEpoch}>swap rows (new epoch)</button>
      <button onClick={mutateOptimistically}>optimistic update (no epoch bump)</button>
      <DataTable columns={columns} rows={activeRows} selectable selectedIds={selectedIds}
        onToggleRow={onToggleRow} onToggleAll={onToggleAll} />
    </>
  )
}

describe('DataTable · SELECT-RACE-1 race regression (select-all survives a stale rows swap)', () => {
  it('clears the selection entirely — not a partial overlap count — when a new epoch swaps the rows out from under a select-all', async () => {
    const user = userEvent.setup()
    // B overlaps A on ids 5/6/7 only — exactly the shape of Danny's report: a
    // filter/page refetch replaces most rows but a few ids still appear on both
    // sides, so a partial selection ("1 geselecteerd") would otherwise survive.
    const rowsA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => ({ id, name: `A${id}`, city: 'X' }))
    const rowsB = [5, 6, 7, 11, 12, 13, 14, 15, 16, 17].map(id => ({ id, name: `B${id}`, city: 'Y' }))
    render(<RaceTable rowsA={rowsA} rowsB={rowsB} />)

    await user.click(screen.getByLabelText('selectAll'))
    expect(screen.getAllByLabelText('selectRow').every(cb => cb.checked)).toBe(true)

    // The server result lands — rows swap, epoch bumps — while the stale
    // 10-row selection from A is still in place.
    await user.click(screen.getByText('swap rows (new epoch)'))

    expect(screen.getAllByLabelText('selectRow').some(cb => cb.checked)).toBe(false)
    expect(screen.getByLabelText('selectAll')).not.toBeChecked()
  })

  it('CRITICAL GUARD: an optimistic rows update (new array, same ids, no epoch bump) leaves the selection intact', async () => {
    const user = userEvent.setup()
    const rowsA = [1, 2].map(id => ({ id, name: `A${id}`, city: 'X' }))
    render(<RaceTable rowsA={rowsA} rowsB={rowsA} />)

    await user.click(screen.getByLabelText('selectAll'))
    expect(screen.getAllByLabelText('selectRow').every(cb => cb.checked)).toBe(true)

    // Mirrors setCandidates/setApplications/setVacancies/setCustomers inside a
    // bulk action: the rows array gets a fresh reference but the epoch never
    // bumps (no fetch ran) — the selection made just above must survive.
    await user.click(screen.getByText('optimistic update (no epoch bump)'))
    expect(screen.getAllByLabelText('selectRow').every(cb => cb.checked)).toBe(true)
    expect(screen.getByLabelText('selectAll')).toBeChecked()
  })
})

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

// DATATABLE-EXPAND-1: opt-in expandable rows — a chevron column that opens a
// detail panel <tr> underneath the row.
describe('DataTable — expandable rows (DATATABLE-EXPAND-1)', () => {
  it('renders no chevron column and no extra markup when renderExpanded is omitted (byte-identical for existing callers)', () => {
    render(<DataTable columns={columns} rows={rows} />)
    expect(screen.queryAllByRole('button', { name: /details/i })).toHaveLength(0)
    // Two data rows only — no hidden panel rows in the DOM at all.
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  it('opens and closes the panel on chevron click, toggling aria-expanded', async () => {
    const user = userEvent.setup()
    render(
      <DataTable columns={columns} rows={rows}
        renderExpanded={row => <div>Details for {row.name}</div>}
        expandLabel="Show details" />
    )
    const toggles = screen.getAllByRole('button', { name: 'Show details' })
    expect(toggles).toHaveLength(2)
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Details for Bob')).not.toBeInTheDocument()

    await user.click(toggles[0])
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Details for Bob')).toBeInTheDocument()
    // The second row's panel stays closed independently.
    expect(screen.queryByText('Details for Ann')).not.toBeInTheDocument()

    await user.click(toggles[0])
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Details for Bob')).not.toBeInTheDocument()
  })

  it('is keyboard operable — Enter on the focused chevron button toggles the panel', async () => {
    const user = userEvent.setup()
    render(
      <DataTable columns={columns} rows={rows}
        renderExpanded={row => <div>Details for {row.name}</div>}
        expandLabel="Show details" />
    )
    const toggle = screen.getAllByRole('button', { name: 'Show details' })[0]
    toggle.focus()
    expect(toggle).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Details for Bob')).toBeInTheDocument()
  })
})
