/**
 * ReportStatStrip — the icon + big number + caption cells at the top of a report drawer
 * (the customer drawer's counts, the run drawer's metrics). CLONE-BY-CONSTRUCTION-1: both
 * drawers painted the same cell markup; the cell lives here once, and each caller keeps
 * its own frame (border, margins) through `style` and its own cell padding.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Caption } from '@/components/ui/typography'

export interface ReportStatItem { label: string; value: ReactNode; icon: LucideIcon }

// One strip: equal cells on the hover surface; the caller merges its frame style in.
export default function ReportStatStrip({ items, style, cellPadding = '10px 16px' }: {
  items: ReportStatItem[]
  style?: CSSProperties
  cellPadding?: string
}) {
  return (
    <div style={{ display: 'flex', gap: 1, background: 'var(--hover-bg)', ...style }}>
      {items.map(b => (
        <div key={b.label} style={{ flex: 1, padding: cellPadding, textAlign: 'center', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <b.icon size={12} color="var(--text-muted)" />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{b.value}</span>
          </div>
          <Caption as="div" style={{ marginTop: 1 }}>{b.label}</Caption>
        </div>
      ))}
    </div>
  )
}
