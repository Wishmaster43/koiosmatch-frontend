/**
 * DrawerHeaderRow — shared drawer-header row: a PageTitle (as="div") with a
 * per-caller meta slot below it, and a close button on the right, in the
 * canonical 14px/18px padded flex row (DRY round 10, DRAWERSHELLS clone [6]).
 * The panel's own width/background stays with each caller; this only carries
 * the identical header ROW markup.
 */
import type { ReactNode } from 'react'
import { PageTitle } from '@/components/ui/typography'
import DrawerCloseButton from './DrawerCloseButton'

interface DrawerHeaderRowProps {
  title: ReactNode
  // Per-caller content below the title (count text, period pager, …).
  meta?: ReactNode
  onClose: () => void
  closeAriaLabel: string
}

// The title + meta + close-button row shared by EntityListDrawer and ShiftsDrillDownDrawer.
export default function DrawerHeaderRow({ title, meta, onClose, closeAriaLabel }: DrawerHeaderRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div>
        <PageTitle as="div">{title}</PageTitle>
        {meta}
      </div>
      <DrawerCloseButton onClick={onClose} ariaLabel={closeAriaLabel} style={{ marginLeft: 10 }} />
    </div>
  )
}
