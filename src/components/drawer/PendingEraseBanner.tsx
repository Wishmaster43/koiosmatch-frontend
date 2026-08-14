import type { ReactNode } from 'react'
import { ArchiveRestore } from 'lucide-react'
import type { Id } from '@/types/common'

interface PendingEraseBannerProps {
  id: Id | undefined
  // Pre-translated status line ("In trash since … · erased around …") — dumb like
  // ArchivedBanner, so one component serves every entity's own i18n namespace.
  message: ReactNode
  // Absent (no permission for the unmark route) → the button doesn't render.
  onUnmark?: (id: Id | undefined) => void
  // Pre-translated tooltip/aria-label for the unmark ("back to archive") button.
  unmarkLabel: string
}

/**
 * PendingEraseBanner (TRASH-OVERAL-2) — the ONE shared in-drawer trash state for
 * trash-enabled entities: the danger-tinted sibling of ArchivedBanner. Shows the
 * pending-erase line (since-when + projected erase moment) plus the unmark action
 * that puts the record back into the plain archive. Restore-to-active stays the
 * archived view's own ArchivedBanner/restore path.
 */
export default function PendingEraseBanner({ id, message, onUnmark, unmarkLabel }: PendingEraseBannerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 8, fontSize: 12,
      color: 'var(--color-danger)', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-danger) 28%, transparent)' }}>
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      {onUnmark && (
        <button onClick={() => onUnmark(id)} title={unmarkLabel} aria-label={unmarkLabel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: 'var(--color-danger)' }}>
          <ArchiveRestore size={14} />
        </button>
      )}
    </div>
  )
}
