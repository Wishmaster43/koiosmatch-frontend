/**
 * ModalFooter — the ONE cancel/submit footer for modals (HUISSTIJL-1: this exact
 * row was found copied word-for-word 16 times across modals before it existed).
 * Pure presentational; labels arrive translated from the caller, so this file
 * carries no i18n keys of its own. Composes the house Button — never restyles.
 * (pages/candidates/addmodal/ModalFooter is the candidate-specific ancestor and
 * migrates onto this in the sweep.)
 */
import type { ReactNode } from 'react'
import Button from './Button'

// The one cancel/submit footer row for modals; omit onSubmit for a close-only dialog.
export default function ModalFooter({ onCancel, onSubmit, cancelLabel, submitLabel, disabled = false, busy = false, danger = false, leftSlot }: {
  onCancel: () => void
  // Omit onSubmit to render a close-only footer (read-only dialogs).
  onSubmit?: () => void
  cancelLabel: string
  submitLabel?: string
  disabled?: boolean
  busy?: boolean
  // Destructive confirm (delete/terminate) — submit renders in the danger variant.
  danger?: boolean
  // Optional left-aligned extra content (e.g. a validation note).
  leftSlot?: ReactNode
}) {
  return (
    <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, background: 'var(--bg)' }}>
      {leftSlot != null && <div style={{ marginRight: 'auto', minWidth: 0 }}>{leftSlot}</div>}
      <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
      {onSubmit && submitLabel && (
        <Button variant={danger ? 'danger' : 'primary'} onClick={onSubmit} disabled={disabled || busy}>
          {busy ? `${submitLabel}…` : submitLabel}
        </Button>
      )}
    </div>
  )
}
