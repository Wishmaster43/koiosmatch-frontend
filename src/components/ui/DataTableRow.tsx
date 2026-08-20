import { memo, Fragment } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Column, RowId } from './DataTable'
import { field, checkboxCol, expandCol, stopPropagation, HIGHLIGHT_BG } from './dataTableUtils'
import { interactiveRow } from '@/lib/a11y'

/**
 * DataTable's row subcomponent (split out 2026-07-21 from DataTable.tsx, same
 * file the audit split threshold was crossed on). Memoized so a click that only
 * changes `selectedId` re-renders the two affected rows, not all 5000+ cells —
 * see DataTable.tsx's docblock for the full rationale.
 *
 * DATATABLE-EXPAND-1 (additive): an optional chevron column + a second <tr>
 * beneath the row that renders the caller's `renderExpanded(row)` panel when
 * expanded. Entirely opt-in — a caller that never passes `renderExpanded`
 * gets the exact same two-column-fewer markup as before.
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
  // DATATABLE-EXPAND-1: present only when the caller opted into expandable rows.
  renderExpanded?: (row: Row) => ReactNode
  isExpanded?: boolean
  onToggleExpand?: (id: RowId) => void
  expandLabel?: string
  // Total <td> span the expanded panel row needs (checkbox + expand + data columns).
  totalCols?: number
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
  renderExpanded, isExpanded = false, onToggleExpand, expandLabel, totalCols,
}: TableRowProps<Row>) {
  const highlight = isSelected || isChecked
  const expandable = !!renderExpanded
  const rowPanelId = `datatable-expand-${String(rowId)}`
  return (
    <Fragment>
      <tr
        {...(virtualIndex !== undefined ? { 'data-index': virtualIndex, ref: measureElement } : {})}
        // Keyboard path (heraudit r3): Enter/Space opens the row, same guard as
        // interactive(); role stays the native row role.
        {...interactiveRow(onRowClick ? () => onRowClick(row) : undefined)}
        style={{ borderBottom: expandable && isExpanded ? 'none' : '1px solid var(--border)', cursor: onRowClick ? 'pointer' : 'default',
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
        {expandable && (
          <td style={expandCol} onClick={stopPropagation}>
            {/* Real <button>, aria-expanded + aria-controls so the panel below is
                announced and keyboard-reachable — never a bare clickable icon. */}
            <button type="button" onClick={() => onToggleExpand?.(rowId)}
              aria-expanded={isExpanded} aria-controls={rowPanelId} aria-label={expandLabel}
              title={expandLabel}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)' }}>
              {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </button>
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
      {expandable && isExpanded && (
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          <td id={rowPanelId} colSpan={totalCols} style={{ padding: '0 10px 12px', background: 'var(--hover-bg)' }}>
            {renderExpanded!(row)}
          </td>
        </tr>
      )}
    </Fragment>
  )
}
// Generic components lose their type param through memo()'s signature — cast back.
export const TableRow = memo(TableRowInner) as typeof TableRowInner
