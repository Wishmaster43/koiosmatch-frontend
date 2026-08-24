/**
 * ReportGrid — the ONE two-column grid every report page lays its section cards
 * into (REPORTGRID-1), mirroring the dashboard's card grid idiom. Children are
 * cards (ReportSectionCard); a `span={2}` child (typically a wide table) takes
 * the full row. Collapses to one column under ~900px via CSS only — no JS
 * resize listener, no horizontal page scroll (the grid itself never overflows;
 * a wide table inside a cell scrolls in its own frame).
 */
import type { CSSProperties, ReactNode } from 'react'

// One child of the grid: `span=2` makes it span both columns (wide tables).
export function ReportGridItem({ span, children }: { span?: 1 | 2; children: ReactNode }) {
  // minWidth 0 lets a wide chart/table shrink inside its grid column (§ responsive).
  const style: CSSProperties = span === 2 ? { gridColumn: '1 / -1', minWidth: 0 } : { minWidth: 0 }
  return <div style={style}>{children}</div>
}

// The grid itself — 1fr/1fr with a 16px gap, one column below the breakpoint.
// The breakpoint class lives in index.css (`.report-grid`) so the collapse is
// pure CSS, never a JS media-query listener.
export default function ReportGrid({ children }: { children: ReactNode }) {
  return <div className="report-grid">{children}</div>
}
