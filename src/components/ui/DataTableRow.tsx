import { memo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { Column, RowId } from './DataTable'
import { field, checkboxCol, stopPropagation, HIGHLIGHT_BG } from './dataTableUtils'

/**
 * DataTable's row subcomponent (split out 2026-07-21 from DataTable.tsx, same
 * file the audit split threshold was crossed on). Memoized so a click that only
 * changes `selectedId` re-renders the two affected rows, not all 5000+ cells —
 * see DataTable.tsx's docblock for the full rationale.
 */
interface TableRowProps<Row> {
  row: Row
  columns: Column<Row>[]
  rowId: RowId
  isSelected: boolean
  isChecked: boolean
  selectable: boolean
  stickyOffsets: (number | null)[]
  onRowClick?: (row: Row) => void
  // Job 43: the checkbox's native click event carries the shift-key flag through, so
  // the table (not the caller) can resolve a shift-click into a range selection.
  onToggleRow?: (id: RowId, shiftKey?: boolean) => void
  virtualIndex?: number
  measureElement?: (node: Element | null) => void
  selectRowLabel: string
}

// One table row — memoized (audit item 7): a row only re-renders when ITS OWN
// props change (its data, or its own selected/checked flag flips), never because
// a sibling row or unrelated table state changed. `onRowClick`/`onToggleRow` are
// stable wrappers from the parent (see stableRowClick/stableToggleRow in DataTable.tsx),
// so a caller that doesn't memoize its own handler still gets the full benefit —
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
          {/* Job 43: forward the shift-key from the native click event (onChange's
              nativeEvent is the triggering MouseEvent for a checkbox) so a shift-click
              can be resolved into a range selection one level up. */}
          <input type="checkbox" checked={!!isChecked}
            onChange={e => onToggleRow?.(rowId, (e.nativeEvent as MouseEvent).shiftKey)}
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
export const TableRow = memo(TableRowInner) as typeof TableRowInner
