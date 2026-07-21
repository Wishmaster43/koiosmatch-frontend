import { useState, useMemo, useRef, useCallback } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TableRow } from './DataTableRow'
import { field, compare, checkboxCol, SKELETON_ROWS, skeletonBarWidth, shiftRangeIds } from './dataTableUtils'

// Re-exported so existing `import { shiftRangeIds } from '.../DataTable'` call sites
// (incl. the test file) keep working unchanged after the 2026-07-21 utils split.
// eslint-disable-next-line react-refresh/only-export-components -- pure helper re-export, no component; mirrors the original inline export.
export { shiftRangeIds }

/**
 * DataTable — generic, themed list table.
 *
 * Column-driven so it can serve any entity list (candidates, customers,
 * vacancies, tasks…). Each column declares how to render its cell; the table
 * itself only handles layout, row selection, hover, sorting and the
 * loading/empty states.
 *
 * Optional row virtualization (F-11): pass `scrollParentRef` (the vertical
 * scroll container the table lives in) and only the visible rows render — the
 * body stays constant-cost at 10k+ rows. Off by default, so every existing
 * table renders exactly as before until it opts in.
 *
 * Row memoization (audit item 7, 2026-07-15): each row is its own memoized
 * component (`TableRow` in ./DataTableRow.tsx) so a click that only changes
 * `selectedId` re-renders the two affected rows, not all 5000+ cells. This only
 * pays off when the caller's `columns` array is referentially stable (useMemo) —
 * an unstable columns array still forces every row to re-render every time.
 */
export type RowId = string | number

export interface Column<Row> {
  key: string                                 // react key + default field accessor
  header: ReactNode                           // <th> content
  render?: (row: Row) => ReactNode            // cell content (defaults to row[key])
  cellStyle?: CSSProperties                   // extra <td> style (e.g. muted text)
  nowrap?: boolean                            // prevent wrapping in the cell
  align?: 'left' | 'center' | 'right'         // header + cell alignment
  sortable?: boolean                          // enable click-to-sort on this column
  sortValue?: (row: Row) => string | number   // value to sort by (defaults to row[key])
  sticky?: boolean                            // pin column to left edge during horizontal scroll
  width?: number                              // px width used to compute sticky left offsets
}

interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

interface DataTableProps<Row> {
  columns: Column<Row>[]
  rows: Row[]
  getRowId?: (row: Row) => RowId
  onRowClick?: (row: Row) => void
  selectedId?: RowId | null
  loading?: boolean
  loadingText?: string
  emptyText?: string
  selectable?: boolean
  selectedIds?: Set<RowId>
  onToggleRow?: (id: RowId) => void
  onToggleAll?: (ids: RowId[], allSelected: boolean) => void
  stickyHeader?: boolean
  defaultSort?: SortState | null
  // Virtualization (opt-in): the vertical scroll container the table sits in.
  scrollParentRef?: RefObject<HTMLElement | null>
  estimatedRowHeight?: number
}

export default function DataTable<Row>({
  columns,
  rows,
  getRowId = (row: Row) => (row as { id: RowId }).id,
  onRowClick,
  selectedId,
  loading = false,
  loadingText,
  emptyText,
  // Optional multi-select (off by default so other lists are unaffected).
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  // When true the thead stays fixed while the table body scrolls.
  stickyHeader = false,
  // Optional default sort applied on first render: { key: 'colKey', dir: 'asc' | 'desc' }
  defaultSort = null,
  scrollParentRef,
  estimatedRowHeight = 44,
}: DataTableProps<Row>) {
  const { t } = useTranslation('common')
  const [sort, setSort] = useState<SortState | null>(defaultSort)

  const toggleSort = (col: Column<Row>) => {
    setSort(prev => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' }
      return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    if (!col) return rows
    const valueOf = col.sortValue ?? ((row: Row) => field(row, col.key) as string | number)
    const sorted = [...rows].sort((a, b) => compare(valueOf(a), valueOf(b)))
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [rows, sort, columns])

  // Virtualizer: idle (no scroll element) when the caller doesn't opt in.
  const virtualize = !!scrollParentRef
  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => scrollParentRef?.current ?? null,
    estimateSize: () => estimatedRowHeight,
    overscan: 12,
  })

  const pageIds      = sortedRows.map(getRowId)
  const allSelected  = selectable && pageIds.length > 0 && pageIds.every(id => selectedIds?.has(id))
  const someSelected = selectable && pageIds.some(id => selectedIds?.has(id))

  // Stable wrappers around the caller's onRowClick/onToggleRow (audit item 7): most
  // callers don't wrap these in useCallback, which would otherwise bust every row's
  // memo on every DataTable render. Reading the latest callback via a ref keeps
  // TableRow's props — and therefore its memo — stable regardless of the caller.
  const onRowClickRef = useRef(onRowClick)
  onRowClickRef.current = onRowClick
  const stableRowClick = useCallback((row: Row) => onRowClickRef.current?.(row), [])
  const onToggleRowRef = useRef(onToggleRow)
  onToggleRowRef.current = onToggleRow
  // Job 43 (shift-click range selection): refs so the stable callback below always
  // reads the LATEST page order/selection without being recreated (which would bust
  // every row's memo — see the docblock at the top of this file).
  const pageIdsRef = useRef(pageIds)
  pageIdsRef.current = pageIds
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  // The last row checkbox the user explicitly clicked (plain or shift) — the anchor
  // a subsequent shift-click ranges from. A ref, not state: it never needs to render.
  const lastClickedIdRef = useRef<RowId | null>(null)
  // Wraps the caller's single-id onToggleRow (a per-id XOR toggle). A plain click just
  // toggles this row and becomes the new anchor. A SHIFT click resolves the row's OWN
  // new checked state (its current state, flipped) and applies that SAME state to
  // every row between the anchor and here — by calling the caller's toggle only for
  // the ids that actually need to flip, so an already-correct row in the range is left
  // alone (onToggleRow is a pure XOR toggle, not a "set to" — this is what keeps the
  // whole range consistent instead of re-flipping rows that already match).
  const stableToggleRow = useCallback((id: RowId, shiftKey?: boolean) => {
    const toggle = onToggleRowRef.current
    if (shiftKey && lastClickedIdRef.current != null) {
      const targetChecked = !selectedIdsRef.current?.has(id)
      shiftRangeIds(pageIdsRef.current, lastClickedIdRef.current, id)
        .forEach(rid => { if (!!selectedIdsRef.current?.has(rid) !== targetChecked) toggle?.(rid) })
    } else {
      toggle?.(id)
    }
    lastClickedIdRef.current = id
  }, [])
  const selectRowLabel = t('selectRow')

  // Pre-compute sticky left offsets: checkbox (36px if selectable) + widths of preceding sticky cols.
  const stickyOffsets = useMemo(() => {
    let offset = selectable ? 36 : 0
    return columns.map(col => {
      if (!col.sticky) return null
      const left = offset
      offset += col.width ?? 0
      return left
    })
  }, [columns, selectable])

  // Sticky offset applied to every <th> when stickyHeader is enabled.
  const stickyTh: CSSProperties = stickyHeader ? { position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)' } : {}

  // Build sticky-column style for a column at index i (header only — body cells use TableRow).
  const stickyColStyle = (i: number, bg = 'var(--bg)'): CSSProperties => {
    const left = stickyOffsets[i]
    if (left === null) return {}
    return { position: 'sticky', left, zIndex: 1, background: bg }
  }

  const totalCols = columns.length + (selectable ? 1 : 0)

  // Virtualized body: two spacer rows keep the scrollbar height correct while only
  // the visible window of real <tr>s renders (sticky header/columns keep working).
  const virtualItems = virtualize ? rowVirtualizer.getVirtualItems() : []
  const paddingTop    = virtualItems.length ? virtualItems[0].start : 0
  const paddingBottom = virtualItems.length ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0

  return (
    <table aria-busy={loading} style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      {/* Screen-reader-only loading announcement — the skeleton rows below carry no
          text of their own, so this is the only accessible signal that data is loading. */}
      {loading && <caption className="sr-only">{loadingText ?? t('loading')}</caption>}
      <thead>
        <tr style={{ borderBottom: '2px solid var(--border)' }}>
          {selectable && (
            <th style={{ ...checkboxCol, ...stickyTh }}>
              <input type="checkbox" checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={() => onToggleAll?.(pageIds, allSelected)}
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label={t('selectAll')} />
            </th>
          )}
          {columns.map((col, i) => {
            const active = sort?.key === col.key
            const baseStyle: CSSProperties = { padding: '8px 10px', textAlign: col.align ?? 'left', fontSize: 11,
              fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
              ...(col.width ? { minWidth: col.width, width: col.width } : {}),
              ...stickyTh, ...stickyColStyle(i),
              // sticky header + sticky col: bump zIndex so corner cell stays above both axes
              ...(stickyHeader && col.sticky ? { zIndex: 3 } : {}) }
            if (!col.sortable) {
              return <th key={col.key} style={baseStyle}>{col.header}</th>
            }
            const justify = col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
            return (
              <th key={col.key} style={{ ...baseStyle, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort(col)}
                title={t('sort')}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: justify }}>
                  {col.header}
                  {active
                    ? (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                    : <ChevronsUpDown size={12} style={{ opacity: 0.35 }} />}
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: SKELETON_ROWS }).map((_, ri) => (
            <tr key={`skeleton-${ri}`} style={{ borderBottom: '1px solid var(--border)' }}>
              {selectable && <td style={checkboxCol} />}
              {columns.map((col, ci) => (
                <td key={col.key} style={{ padding: '10px 10px', ...(col.width ? { minWidth: col.width, width: col.width } : {}) }}>
                  <div className="animate-pulse" style={{ height: 12, borderRadius: 4, background: 'var(--hover-bg)', width: skeletonBarWidth(ri + ci) }} />
                </td>
              ))}
            </tr>
          ))
        ) : virtualize ? (
          <>
            {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={totalCols} style={{ padding: 0, border: 'none' }} /></tr>}
            {virtualItems.map(vi => {
              const row = sortedRows[vi.index]
              const id  = getRowId(row)
              return (
                <TableRow key={id} row={row} columns={columns} rowId={id}
                  isSelected={selectedId != null && id === selectedId}
                  isChecked={!!(selectable && selectedIds?.has(id))}
                  selectable={selectable} stickyOffsets={stickyOffsets}
                  onRowClick={stableRowClick} onToggleRow={stableToggleRow}
                  virtualIndex={vi.index} measureElement={rowVirtualizer.measureElement}
                  selectRowLabel={selectRowLabel} />
              )
            })}
            {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={totalCols} style={{ padding: 0, border: 'none' }} /></tr>}
          </>
        ) : (
          sortedRows.map(row => {
            const id = getRowId(row)
            return (
              <TableRow key={id} row={row} columns={columns} rowId={id}
                isSelected={selectedId != null && id === selectedId}
                isChecked={!!(selectable && selectedIds?.has(id))}
                selectable={selectable} stickyOffsets={stickyOffsets}
                onRowClick={stableRowClick} onToggleRow={stableToggleRow}
                selectRowLabel={selectRowLabel} />
            )
          })
        )}
        {!loading && sortedRows.length === 0 && (
          <tr>
            <td colSpan={totalCols} style={{ padding: '40px 10px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {emptyText ?? t('noResults')}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
