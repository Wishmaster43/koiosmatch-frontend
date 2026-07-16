import { useState, useMemo, useRef, useCallback, memo } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useVirtualizer } from '@tanstack/react-virtual'

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
 * component (see TableRow below) so a click that only changes `selectedId`
 * re-renders the two affected rows, not all 5000+ cells. This only pays off
 * when the caller's `columns` array is referentially stable (useMemo) — an
 * unstable columns array still forces every row to re-render every time.
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

// Read a column's default field off an unknown-shaped row (dynamic accessor).
const field = (row: unknown, key: string): unknown => (row as Record<string, unknown>)[key]

// Comparator: empty/null sort last; numbers numerically; strings naturally.
function compare(a: unknown, b: unknown): number {
  const na = a === '' || a == null
  const nb = b === '' || b == null
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// Shared static styles (module scope — no closures, so no reason to recreate per render).
const checkboxCol: CSSProperties = { width: 36, padding: '8px 10px', textAlign: 'center' }
const stopPropagation = (e: { stopPropagation: () => void }) => e.stopPropagation()

// Selected/checked row tint (audit item 1, 2026-07-16): a STICKY column (e.g. the
// pinned Name cell) paints its OWN opaque background on top of the <tr>'s background
// so scrolled-under content stays hidden while scrolling horizontally. Painting the
// translucent `var(--color-primary-bg)` token on BOTH layers double-composites it —
// the sticky cell reads as a visibly darker/different-coloured block than the rest
// of the same row (reported as "the name turns a different colour when selected",
// most visible whenever --color-primary-bg is translucent: any tenant with a custom
// brand colour, and dark mode for every tenant). Pre-mixing straight into the opaque
// --bg token keeps this single-layer and fully opaque in both states, so the sticky
// cell and the rest of the row always render the exact same solid tint.
const HIGHLIGHT_BG = 'color-mix(in srgb, var(--color-primary) 12%, var(--bg))'

// Loading skeleton (audit item 17): a fixed number of placeholder rows so the
// table header/chrome stays put and the body doesn't "jump" from a centred
// spinner to real rows. Bar widths vary per column so the shape reads as text,
// not a solid block; token-based colour only (no ad-hoc grey, works in dark mode).
const SKELETON_ROWS = 8
const SKELETON_BAR_WIDTHS = ['85%', '60%', '75%', '50%', '90%', '65%']
const skeletonBarWidth = (i: number) => SKELETON_BAR_WIDTHS[i % SKELETON_BAR_WIDTHS.length]

interface TableRowProps<Row> {
  row: Row
  columns: Column<Row>[]
  rowId: RowId
  isSelected: boolean
  isChecked: boolean
  selectable: boolean
  stickyOffsets: (number | null)[]
  onRowClick?: (row: Row) => void
  onToggleRow?: (id: RowId) => void
  virtualIndex?: number
  measureElement?: (node: Element | null) => void
  selectRowLabel: string
}

// One table row — memoized (audit item 7): a row only re-renders when ITS OWN
// props change (its data, or its own selected/checked flag flips), never because
// a sibling row or unrelated table state changed. `onRowClick`/`onToggleRow` are
// stable wrappers from the parent (see stableRowClick/stableToggleRow below), so
// a caller that doesn't memoize its own handler still gets the full benefit —
// only an unstable `columns` array (or a genuinely new `row` object) busts this.
function TableRowInner<Row>({
  row, columns, rowId, isSelected, isChecked, selectable, stickyOffsets,
  onRowClick, onToggleRow, virtualIndex, measureElement, selectRowLabel,
}: TableRowProps<Row>) {
  const highlight = isSelected || isChecked
  return (
    <tr
      {...(virtualIndex !== undefined ? { 'data-index': virtualIndex, ref: measureElement } : {})}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      style={{ borderBottom: '1px solid var(--border)', cursor: onRowClick ? 'pointer' : 'default',
        background: highlight ? HIGHLIGHT_BG : 'transparent' }}
      onMouseEnter={e => { if (!highlight) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.querySelectorAll('td[data-sticky]').forEach(td => { (td as HTMLElement).style.background = 'var(--hover-bg)' }) } }}
      onMouseLeave={e => { if (!highlight) { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelectorAll('td[data-sticky]').forEach(td => { (td as HTMLElement).style.background = 'var(--bg)' }) } }}>
      {selectable && (
        <td style={checkboxCol} onClick={stopPropagation}>
          <input type="checkbox" checked={!!isChecked} onChange={() => onToggleRow?.(rowId)}
            style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label={selectRowLabel} />
        </td>
      )}
      {columns.map((col, i) => {
        // Sticky cells need the same background as the row to cover scrolled content —
        // HIGHLIGHT_BG (always opaque) so this never double-composites with the <tr>'s
        // own background above (see the HIGHLIGHT_BG comment, job 1 2026-07-16).
        const rowBg = highlight ? HIGHLIGHT_BG : 'var(--bg)'
        const left = stickyOffsets[i]
        const stickyStyle: CSSProperties = left == null ? {} : { position: 'sticky', left, zIndex: 1, background: rowBg }
        return (
          <td key={col.key}
            {...(col.sticky ? { 'data-sticky': true } : {})}
            style={{ padding: '10px 10px', textAlign: col.align ?? 'left',
              whiteSpace: col.nowrap ? 'nowrap' : undefined,
              ...(col.width ? { minWidth: col.width, width: col.width } : {}),
              ...col.cellStyle, ...stickyStyle }}>
            {col.render ? col.render(row) : (field(row, col.key) as ReactNode)}
          </td>
        )
      })}
    </tr>
  )
}
// Generic components lose their type param through memo()'s signature — cast back.
const TableRow = memo(TableRowInner) as typeof TableRowInner

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
  const stableToggleRow = useCallback((id: RowId) => onToggleRowRef.current?.(id), [])
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
