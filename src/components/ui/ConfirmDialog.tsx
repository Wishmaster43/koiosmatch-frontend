/**
 * ConfirmDialog — the ONE shared modal for every destructive/blocking confirmation,
 * replacing native window.confirm() across the app (§0 restschuld cleanup; Danny
 * approved this pattern earlier — mirrors ActionRuleDialog's shape). Small overlay
 * panel in house style: optional title, message, Cancel (border) + Confirm (primary,
 * or danger for destructive actions). Traps focus and closes on Escape via the
 * shared useFocusTrap hook. Colours are tokens only (§4).
 */
import { useTranslation } from 'react-i18next'
import FloatingPanel from '@/components/ui/FloatingPanel'
import { BodyText } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
  // Optional rich content under the message (e.g. a preflight mismatch list).
  children?: ReactNode
  // Info/preflight mode: only the confirm button (there is nothing to cancel).
  hideCancel?: boolean
  open: boolean
  message: string
  title?: string
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}


// POPUP-SLEEP (Danny punt 19, "elke popup sleepbaar"): the hand-rolled overlay is
// replaced by the shared FloatingPanel, so a confirmation that lands on top of the
// very row it asks about can be dragged aside. The title row IS the drag handle;
// a title-less caller keeps a plain grab strip (no close X, so the dialog still has
// exactly two answers). Focus trap, Escape-to-cancel and the token colours are the
// house behaviour FloatingPanel already carries.
export default function ConfirmDialog({ open, message, title, danger, confirmLabel, cancelLabel, onConfirm, onCancel, children, hideCancel = false }: ConfirmDialogProps) {
  const { t } = useTranslation('common')

  return (
    // The panel GROWS with its buttons instead of sitting at a fixed 380px: a caller
    // may pass a label as long as "Nee, laat Anouk Mulder primair", which wrapped to
    // two lines inside a fixed-height button and got CLIPPED (Danny 28-07, "TXT ziet
    // er niet uit"). min/max keep the usual dialogs the same size as before.
    <FloatingPanel open={open} onClose={onCancel} ariaLabel={title ?? message}
      width="auto" maxWidth="min(620px, 90vw)" resizable={false} hideClose
      bodyStyle={{ minWidth: 380, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
      header={title ? <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{title}</div> : <div style={{ flex: 1 }} />}>
      <BodyText as="div">{message}</BodyText>
      {children}
      {/* Buttons keep their label on ONE line (nowrap) and the row wraps instead —
          so a narrow screen stacks them rather than cutting text off. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        {/* House Buttons (r9 boy-scout): the shared confirm dialog hand-drew both
            actions — identity comes from Button (danger keeps its fixed pair). */}
        {!hideCancel && <Button variant="secondary" onClick={onCancel}>{cancelLabel ?? t('cancel')}</Button>}
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel ?? t('confirm')}</Button>
      </div>
    </FloatingPanel>
  )
}
