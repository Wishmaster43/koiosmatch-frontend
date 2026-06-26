import { useState, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * DataTable — generic, themed list table.
 *
 * Column-driven so it can serve any entity list (candidates, customers,
 * vacancies, tasks…). Each column declares how to render its cell; the table
 * itself only handles layout, row selection, hover, sorting and the
 * loading/empty states.
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

  const pageIds      = sortedRows.map(getRowId)
  const allSelected  = selectable && pageIds.length > 0 && pageIds.every(id => selectedIds?.has(id))
  const someSelected = selectable && pageIds.some(id => selectedIds?.has(id))
  const checkboxCol: CSSProperties = { width: 36, padding: '8px 10px', textAlign: 'center' }
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

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

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        {loadingText ?? t('loading')}
      </div>
    )
  }

  // Sticky offset applied to every <th> when stickyHeader is enabled.
  const stickyTh: CSSProperties = stickyHeader ? { position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)' } : {}

  // Build sticky-column style for a column at index i.
  // Default bg is --bg (page background) because table rows are transparent and show --bg through.
  const stickyColStyle = (i: number, bg = 'var(--bg)'): CSSProperties => {
    const left = stickyOffsets[i]
    if (left === null) return {}
    return { position: 'sticky', left, zIndex: 1, background: bg }
  }

  return (
    <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
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
        {sortedRows.map(row => {
          const id = getRowId(row)
          const isSelected = selectedId != null && id === selectedId
          const isChecked  = selectable && selectedIds?.has(id)
          const highlight  = isSelected || isChecked
          return (
            <tr key={id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{ borderBottom: '1px solid var(--border)', cursor: onRowClick ? 'pointer' : 'default',
                background: highlight ? 'var(--color-primary-bg)' : 'transparent' }}
              onMouseEnter={e => { if (!highlight) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.querySelectorAll('td[data-sticky]').forEach(td => { (td as HTMLElement).style.background = 'var(--hover-bg)' }) } }}
              onMouseLeave={e => { if (!highlight) { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelectorAll('td[data-sticky]').forEach(td => { (td as HTMLElement).style.background = 'var(--bg)' }) } }}>
              {selectable && (
                <td style={checkboxCol} onClick={stop}>
                  <input type="checkbox" checked={!!isChecked} onChange={() => onToggleRow?.(id)}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label={t('selectRow')} />
                </td>
              )}
              {columns.map((col, i) => {
                // Sticky cells need the same background as the row to cover scrolled content.
                const rowBg = highlight ? 'var(--color-primary-bg)' : 'var(--bg)'
                return (
                  <td key={col.key}
                    {...(col.sticky ? { 'data-sticky': true } : {})}
                    style={{ padding: '10px 10px', textAlign: col.align ?? 'left',
                      whiteSpace: col.nowrap ? 'nowrap' : undefined,
                      ...(col.width ? { minWidth: col.width, width: col.width } : {}),
                      ...col.cellStyle, ...stickyColStyle(i, rowBg) }}>
                    {col.render ? col.render(row) : (field(row, col.key) as ReactNode)}
                  </td>
                )
              })}
            </tr>
          )
        })}
        {sortedRows.length === 0 && (
          <tr>
            <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: '40px 10px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {emptyText ?? t('noResults')}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
