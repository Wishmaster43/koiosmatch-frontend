/** DataTable · selection (split from DataTable.test.tsx; select-all busy/race and shift-click range; the core, sort and expand tests stay there). */
import { useState, useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DataTable from './DataTable'
import type { RowId } from './DataTable'
import { columns, rows } from './DataTable.testKit'

// Job 43 — shift-click range selection wired end-to-end. A tiny stateful wrapper
// mirrors how a real caller (useCandidateBulkActions' toggleRow) owns `selectedIds`,
// since the range logic reads back the CURRENT selection to decide select vs deselect.
interface Row { id: number; name: string; city: string }
function SelectableTable({ rows: initialRows, initialSelected = [] }: { rows: Row[]; initialSelected?: number[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<RowId>>(new Set(initialSelected))
  const onToggleRow = (id: RowId) => setSelectedIds(prev => {
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
function RaceTable({ rowsA, rowsB }: { rowsA: Row[]; rowsB: Row[] }) {
  const [epoch, setEpoch] = useState(0)
  const [activeRows, setActiveRows] = useState<Row[]>(rowsA)
  const [selectedIds, setSelectedIds] = useState<Set<RowId>>(new Set())
  const onToggleAll = (ids: RowId[], allSelected: boolean) => setSelectedIds(allSelected ? new Set() : new Set(ids))
  const onToggleRow = (id: RowId) => setSelectedIds(prev => {
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
  const mutateOptimistically = () => setActiveRows(prev => prev.map((r: Row) => ({ ...r, name: `${r.name}*` })))
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
    expect(screen.getAllByLabelText('selectRow').every(cb => (cb as HTMLInputElement).checked)).toBe(true)

    // The server result lands — rows swap, epoch bumps — while the stale
    // 10-row selection from A is still in place.
    await user.click(screen.getByText('swap rows (new epoch)'))

    expect(screen.getAllByLabelText('selectRow').some(cb => (cb as HTMLInputElement).checked)).toBe(false)
    expect(screen.getByLabelText('selectAll')).not.toBeChecked()
  })

  it('CRITICAL GUARD: an optimistic rows update (new array, same ids, no epoch bump) leaves the selection intact', async () => {
    const user = userEvent.setup()
    const rowsA = [1, 2].map(id => ({ id, name: `A${id}`, city: 'X' }))
    render(<RaceTable rowsA={rowsA} rowsB={rowsA} />)

    await user.click(screen.getByLabelText('selectAll'))
    expect(screen.getAllByLabelText('selectRow').every(cb => (cb as HTMLInputElement).checked)).toBe(true)

    // Mirrors setCandidates/setApplications/setVacancies/setCustomers inside a
    // bulk action: the rows array gets a fresh reference but the epoch never
    // bumps (no fetch ran) — the selection made just above must survive.
    await user.click(screen.getByText('optimistic update (no epoch bump)'))
    expect(screen.getAllByLabelText('selectRow').every(cb => (cb as HTMLInputElement).checked)).toBe(true)
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
