/**
 * BoardColumnHeader — column header (optional dot + label + count pill) shared by
 * every kanban board (applications, matches, tasks). The count pill wears the
 * column colour as an ACTIVE §4 tint; without a colour it falls back to the muted
 * text token so the pill never carries an ad-hoc hex.
 */
import type { ReactNode } from 'react'
import { SectionTitle } from '@/components/ui/typography'
import { tintBg, chipInk } from '@/lib/tint'

export interface BoardColumnHeaderProps {
  label: ReactNode
  count: number
  // Column colour (lookup colour or token); drives the dot and the count pill tint.
  color?: string
  showDot?: boolean
}

export default function BoardColumnHeader({ label, count, color, showDot = true }: BoardColumnHeaderProps) {
  // Token fallback keeps the pill on the design system when a column has no colour.
  const pillColor = color || 'var(--text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {showDot && color && (
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      )}
      <SectionTitle as="span">{label}</SectionTitle>
      <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
        background: tintBg(pillColor, true), color: chipInk(pillColor) }}>
        {count}
      </span>
    </div>
  )
}
