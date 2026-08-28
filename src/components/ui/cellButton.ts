/**
 * cellButton — the ONE style reset for a table-cell deep-link button
 * (CEL-DOORKLIK-CANON): the button renders AS the cell's own content, no
 * chrome. Was copied verbatim in six tables (r2 A1) — §4: extract, adopt.
 */
import type { CSSProperties } from 'react'

export const cellButton: CSSProperties = {
  background: 'none', border: 'none', padding: 0, font: 'inherit',
  cursor: 'pointer', textAlign: 'left',
}
