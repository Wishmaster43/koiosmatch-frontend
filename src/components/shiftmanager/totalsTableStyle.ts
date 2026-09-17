/**
 * totalsTableStyle — the shared header/body CELL LAYOUT for the Shiftmanager
 * name/value(/share) tables (ShiftsDrillDownTotals's GroupTable, ShiftsBreakdownCharts'
 * MiniTable): same padding, border and tabular-nums convention, previously hand-rolled
 * as two near-identical th/td style objects (D1 audit finding). Font IDENTITY (which
 * typography atom's raw style feeds the header) stays with the caller — GroupTable
 * uses Caption's identity, MiniTable uses GroupLabel's uppercase one — so callers spread
 * this UNDER their own font style, never the other way round. `dense` keeps each
 * table's own existing footprint (MiniTable is the tighter of the two).
 */
import type { CSSProperties } from 'react'

// Header cell layout only (border/padding/whiteSpace) — spread the caller's own
// typography identity (captionStyle, groupLabelStyle, …) alongside this.
export function totalsTableHeaderStyle(dense = false): CSSProperties {
  return { padding: dense ? '5px 8px' : '6px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
}

// Body cell: 12px text, tabular-nums for aligned numeric columns.
export function totalsTableCellStyle(dense = false): CSSProperties {
  return { padding: dense ? '5px 8px' : '6px 10px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--hover-bg)', fontVariantNumeric: 'tabular-nums' }
}
