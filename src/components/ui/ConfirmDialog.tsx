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
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title ?? message} tabIndex={-1}
        style={{ width: 380, maxWidth: '90vw', background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {title && <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>}
        <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel}
            style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8,
              border: '1px solid var(--border)', background: 'none', color: 'var(--text)', cursor: 'pointer' }}>
            {cancelLabel ?? t('cancel')}
          </button>
          <button onClick={onConfirm}
            style={{ height: BTN_H, padding: '0 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
              background: danger ? 'var(--color-danger)' : 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
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
