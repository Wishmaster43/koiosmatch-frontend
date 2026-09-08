/**
 * RowField — shared read-mode field row (label left, value right).
 * Used across entity detail tabs for consistent field display.
 */
import type { ReactNode } from 'react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'

interface RowFieldProps {
  label: ReactNode
  children: ReactNode
}

// One read-mode row: the canon label (fieldRowCanon, 05-08: clean cards, no dividers) left, value right.
export default function RowField({ label, children }: RowFieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  )
}
