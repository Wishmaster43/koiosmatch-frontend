/**
 * ConfirmDialog — the ONE shared modal for every destructive/blocking confirmation,
 * replacing native window.confirm() across the app (§0 restschuld cleanup; Danny
 * approved this pattern earlier — mirrors ActionRuleDialog's shape). Small overlay
 * panel in house style: optional title, message, Cancel (border) + Confirm (primary,
 * or danger for destructive actions). Traps focus and closes on Escape via the
 * shared useFocusTrap hook. Colours are tokens only (§4).
 */
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { BTN_H } from '@/config/buttonMetrics'

export interface ConfirmDialogProps {
  open: boolean
  message: string
  title?: string
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// Shared button box: one fixed height, but the label may never be clipped — it stays
// on one line and the row wraps around it instead.
const btnBase = {
  height: BTN_H, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
} as const

// The dialog surface — its own component, mounted only while `open` (mirrors
// ActionRuleDialog): useFocusTrap needs a fresh mount to attach the ref before its
// effect runs; a single always-mounted component that just toggles visibility would not.
function DialogPanel({ message, title, danger, confirmLabel, cancelLabel, onConfirm, onCancel }: Omit<ConfirmDialogProps, 'open'>) {
  const { t } = useTranslation('common')
  // Esc closes + tab-trap + focus-restore (house pattern, mirrors AddCandidateModal / ActionRuleDialog).
  const panelRef = useFocusTrap<HTMLDivElement>(onCancel)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      {/* The panel GROWS with its buttons instead of sitting at a fixed 380px: a caller
          may pass a label as long as "Nee, laat Anouk Mulder primair", which wrapped to
          two lines inside a fixed-height button and got CLIPPED (Danny 28-07, "TXT ziet
          er niet uit"). min/max keep the usual dialogs the same size as before. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title ?? message} tabIndex={-1}
        style={{ width: 'auto', minWidth: 380, maxWidth: 'min(620px, 90vw)', background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {title && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>}
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{message}</div>
        {/* Buttons keep their label on ONE line (nowrap) and the row wraps instead —
            so a narrow screen stacks them rather than cutting text off. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel}
            style={{ ...btnBase, padding: '0 16px', border: '1px solid var(--border)',
              background: 'none', color: 'var(--text)' }}>
            {cancelLabel ?? t('cancel')}
          </button>
          <button onClick={onConfirm}
            style={{ ...btnBase, padding: '0 18px', fontWeight: 600, border: 'none',
              background: danger ? 'var(--color-danger)' : 'var(--color-primary)', color: 'white' }}>
            {confirmLabel ?? t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmDialog({ open, ...rest }: ConfirmDialogProps) {
  if (!open) return null
  return <DialogPanel {...rest} />
}
