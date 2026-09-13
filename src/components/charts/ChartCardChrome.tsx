// ChartCardChrome — the shared title row + empty-state block every chart card
// (line/bar/…) renders identically before its own recharts body. One place to
// keep the "no data" look consistent instead of five hand-copies.
import type { ReactNode } from 'react'

// Muted card title shown above the chart body.
export function ChartCardTitle({ title }: { title?: ReactNode }) {
  return <div className="mb-4 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{title}</div>
}

// Fixed-height empty-state placeholder (caller supplies the empty label/dash).
export function ChartCardEmpty({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center text-xs" style={{ height, color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}
