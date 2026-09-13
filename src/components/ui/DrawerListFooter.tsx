import type { ReactNode } from 'react'
import { Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'

interface DrawerListFooterProps {
  // Left-side summary text (e.g. "shown N of M"), already translated by the caller.
  summary: ReactNode
  onClose: () => void
  closeLabel: string
}

// The shared footer of a list-style drawer/popup (EntityListDrawer, ShiftsDrillDownDrawer):
// a muted shown-of-count caption and a "Close" button on one row.
export function DrawerListFooter({ summary, onClose, closeLabel }: DrawerListFooterProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--hover-bg)',
                  flexShrink: 0 }}>
      <Caption as="span">{summary}</Caption>
      <Button variant="secondary" onClick={onClose}>{closeLabel}</Button>
    </div>
  )
}
