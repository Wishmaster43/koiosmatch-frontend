import type { ReactNode } from 'react'

// Sibling file, not PendingUploadFrame.tsx itself (measured: a non-component
// export there trips react-refresh/only-export-components) — DRY round 11, DOCTABS.
interface PendingUploadItemLike {
  name: string
  size: string
}

/** Shared PendingUploadFrame title: one file keeps the old name+size header, a
 * multi-pick shows the caller's resolved count label instead. The count label
 * is resolved by the caller's own t() (rule C) — this stays a plain data
 * transform.
 */
export function pendingUploadTitle(pending: PendingUploadItemLike[], countLabel: string): ReactNode {
  return pending.length === 1
    ? <>{pending[0].name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pending[0].size})</span></>
    : countLabel
}
