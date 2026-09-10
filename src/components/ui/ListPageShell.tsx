/**
 * ListPageShell — the shared list-page wrapper: an outer flex row (full height,
 * clipped overflow) containing an inner flex column that holds the page's own
 * content, plus an optional `aside` sibling (a detail drawer) rendered next to
 * it, exactly where each page already placed it (DRY round 11, SHIFTMANAGER —
 * "27 identical lines" consolidation across the Shiftmanager mirror pages).
 * `minWidth` differs per page (some need `minWidth: 0` so a wide table can
 * still shrink inside a flex row, others never set it) — carried as a prop,
 * never unified, so every consumer keeps its exact inline style.
 */
import type { CSSProperties, ReactNode } from 'react'

export function ListPageShell({ minWidth, children, aside }: {
  minWidth?: CSSProperties['minWidth']
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth, overflow: 'hidden' }}>
        {children}
      </div>
      {aside}
    </div>
  )
}
