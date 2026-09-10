import type { ReactNode } from 'react'
import { Caption } from '@/components/ui/typography'

interface PendingUploadFrameProps {
  title: ReactNode
  children: ReactNode
}

/** Shared "files queued for upload" card frame for the candidates and customers
 * documents tabs: the tinted bordered card + its title row. Divs only — the
 * title arrives already resolved by the caller's own t() (rule C), and every
 * action/content node between title and card edge is passed as children.
 */
export function PendingUploadFrame({ title, children }: PendingUploadFrameProps) {
  return (
    <div style={{ border: '1px solid var(--color-primary)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-primary-bg)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )
}

interface PendingUploadRowsProps {
  children: ReactNode
}

/** The column wrapper around the queued-file rows (gap-6, 10px bottom margin). */
export function PendingUploadRows({ children }: PendingUploadRowsProps) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>{children}</div>
}

interface PendingUploadRowProps {
  name: string
  size: string
  children: ReactNode
}

/** One queued-file row's shared prefix (filename + size caption); the caller
 * appends its own type/link/remove controls as children. HUISSTIJL-1: the size
 * caption is the shared muted-caption atom (identity-only swap of an 11px span).
 */
export function PendingUploadRow({ name, size, children }: PendingUploadRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <Caption style={{ flexShrink: 0 }}>{size}</Caption>
      {children}
    </div>
  )
}
