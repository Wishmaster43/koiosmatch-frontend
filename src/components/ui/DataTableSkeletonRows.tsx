// Extracted from DataTable (SIZE-SPLIT-B, zero behaviour change): the
// skeleton <tr>s shown while `loading` is true.
import { checkboxCol, expandCol, SKELETON_ROWS, skeletonBarWidth } from './dataTableUtils'
import type { Column } from './DataTable'

export default function DataTableSkeletonRows<Row>({
  columns, selectable, expandable,
}: { columns: Column<Row>[]; selectable: boolean; expandable: boolean }) {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }).map((_, ri) => (
        <tr key={`skeleton-${ri}`} style={{ borderBottom: '1px solid var(--border)' }}>
          {selectable && <td style={checkboxCol} />}
          {expandable && <td style={expandCol} />}
          {columns.map((col, ci) => (
            <td key={col.key} style={{ padding: '10px 10px', ...(col.width ? { minWidth: col.width, width: col.width } : {}) }}>
              <div className="animate-pulse" style={{ height: 12, borderRadius: 4, background: 'var(--hover-bg)', width: skeletonBarWidth(ri + ci) }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
