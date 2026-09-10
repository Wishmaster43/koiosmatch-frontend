import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Caption } from '@/components/ui/typography'
import SelectMenu from '@/components/ui/SelectMenu'
import Button from '@/components/ui/Button'
import type { LookupOption } from '@/types/common'

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

interface PendingUploadTypeSelectProps {
  labelId: string
  label: string
  value: string
  onChange: (value: string) => void
  options: LookupOption[]
}

/** Shared per-row type picker for a queued file: the sr-only label (SelectMenu's
 * trigger is a <button>, so it needs aria-labelledby, never a plain aria-label
 * prop) plus the 130px-wide SelectMenu. G34: the house searchable dropdown
 * replaces the native per-file type <select>. The label text is resolved by
 * the caller's own t() (rule C).
 */
export function PendingUploadTypeSelect({ labelId, label, value, onChange, options }: PendingUploadTypeSelectProps) {
  return (
    <>
      <span id={labelId} className="sr-only">{label}</span>
      <div style={{ width: 130, flexShrink: 0 }}>
        <SelectMenu aria-labelledby={labelId} value={value} onChange={onChange}
          options={options} menuWidth={160}
          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }} />
      </div>
    </>
  )
}

interface PendingUploadRemoveButtonProps {
  onClick: () => void
  ariaLabel: string
}

/** Shared per-row remove glyph for a queued file. 12px inline glyph in a dense
 * queue row, not a Button copy (mirrors EntityHeader's chip-remove precedent) —
 * Button's smallest footprint (28px) would tower over this icon in a tightly
 * packed row. Block form (not -next-line): the flagged style attribute sits a
 * line into this opening tag, and a bare comment can't sit inside a JSX
 * attribute list.
 */
/* eslint-disable huisstijlLegacy/no-restricted-syntax */
export function PendingUploadRemoveButton({ onClick, ariaLabel }: PendingUploadRemoveButtonProps) {
  return (
    <button onClick={onClick} aria-label={ariaLabel}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}>
      <X size={12} />
    </button>
  )
}
/* eslint-enable huisstijlLegacy/no-restricted-syntax */

interface PendingUploadFooterProps {
  addLabel: ReactNode
  cancelLabel: ReactNode
  onAdd: () => void
  onCancel: () => void
}

/** Shared upload/cancel action row under the queued-file list — labels arrive
 * already resolved by the caller's own t() (rule C: the add label differs per
 * consumer's key, singular vs "add all N"). Herhaal-audit r4 finding 2 and its
 * twin: the inverse --text fill is retired on both cards — the primary action
 * wears the house Button, next to a real secondary Button for cancel.
 */
export function PendingUploadFooter({ addLabel, cancelLabel, onAdd, onCancel }: PendingUploadFooterProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="primary" size="sm" onClick={onAdd}>{addLabel}</Button>
      <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>
    </div>
  )
}
