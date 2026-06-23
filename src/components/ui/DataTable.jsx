import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

/**
 * DataTable — generic, themed list table.
 *
 * Column-driven so it can serve any entity list (candidates, customers,
 * vacancies, tasks…). Each column declares how to render its cell; the table
 * itself only handles layout, row selection, hover, sorting and the
 * loading/empty states.
 *
 * columns: Array<{
 *   key:        string                       // react key + default field accessor
 *   header:     ReactNode                    // <th> content
 *   render?:    (row) => ReactNode           // cell content (defaults to row[key])
 *   cellStyle?: CSSProperties                // extra <td> style (e.g. muted text)
 *   nowrap?:    boolean                      // prevent wrapping in the cell
 *   align?:     'left' | 'center' | 'right'  // header + cell alignment
 *   sortable?:  boolean                      // enable click-to-sort on this column
 *   sortValue?: (row) => string | number     // value to sort by (defaults to row[key])
 * }>
 */

// Comparator: empty/null sort last; numbers numerically; strings naturally.
function compare(a, b) {
  const na = a === '' || a == null
  const nb = b === '' || b == null
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export default function DataTable({
  columns,
  rows,
  getRowId = (row) => row.id,
  onRowClick,
  selectedId,
  loading = false,
  loadingText = 'Loading…',
  emptyText = 'No results',
  // Optional multi-select (off by default so other lists are unaffected).
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
}) {
  // sort = { key, dir: 'asc' | 'desc' } | null
  const [sort, setSort] = useState(null)

  const toggleSort = (col) => {
    setSort(prev => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' }
      return { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
    })
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    if (!col) return rows
    const valueOf = col.sortValue ?? (row => row[col.key])
    const sorted = [...rows].sort((a, b) => compare(valueOf(a), valueOf(b)))
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [rows, sort, columns])

  const pageIds      = sortedRows.map(getRowId)
  const allSelected  = selectable && pageIds.length > 0 && pageIds.every(id => selectedIds?.has(id))
  const someSelected = selectable && pageIds.some(id => selectedIds?.has(id))
  const checkboxCol  = { width: 36, padding: '8px 10px', textAlign: 'center' }
  const stop = (e) => e.stopPropagation()

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        {loadingText}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid var(--border)' }}>
          {selectable && (
            <th style={checkboxCol}>
              <input type="checkbox" checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={() => onToggleAll?.(pageIds, allSelected)}
                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label="Selecteer alles" />
            </th>
          )}
          {columns.map(col => {
            const active = sort?.key === col.key
            const baseStyle = { padding: '8px 10px', textAlign: col.align ?? 'left', fontSize: 11,
              fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }
            if (!col.sortable) {
              return <th key={col.key} style={baseStyle}>{col.header}</th>
            }
            const justify = col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start'
            return (
              <th key={col.key} style={{ ...baseStyle, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort(col)}
                title="Sorteren">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: justify,
                  color: active ? 'var(--text)' : undefined }}>
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
              onMouseEnter={e => { if (!highlight) e.currentTarget.style.background = 'var(--hover-bg)' }}
              onMouseLeave={e => { if (!highlight) e.currentTarget.style.background = 'transparent' }}>
              {selectable && (
                <td style={checkboxCol} onClick={stop}>
                  <input type="checkbox" checked={!!isChecked} onChange={() => onToggleRow?.(id)}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }} aria-label="Selecteer rij" />
                </td>
              )}
              {columns.map(col => (
                <td key={col.key} style={{ padding: '10px 10px', textAlign: col.align ?? 'left',
                  whiteSpace: col.nowrap ? 'nowrap' : undefined, ...col.cellStyle }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          )
        })}
        {sortedRows.length === 0 && (
          <tr>
            <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: '40px 10px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {emptyText}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
