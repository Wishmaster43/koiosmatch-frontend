/**
 * Shared frame/chrome for customer sub-entity create/edit modals (AddDepartmentModal,
 * AddLocationModal, AddContactPersonModal): the FloatingPanel header (icon + title +
 * import button), the import card and error alert slots, and the ModalFooter. Each
 * modal provides only the form fields in children; the frame owns the chrome.
 */
import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Button from '@/components/ui/Button'
import ModalFooter from '@/components/ui/ModalFooter'
import { WIDE_MODAL } from '@/components/ui/modalMetrics'
import { cardBox, cardHead } from '@/components/ui/modalCards'

interface SubEntityModalFrameProps {
  open: boolean
  onClose: () => void
  ariaLabel: string
  persistKey: string
  isEdit: boolean
  title: string
  subtitle?: string
  icon: LucideIcon
  iconColor: string
  iconBg: string
  importOpen: boolean
  setImportOpen: (open: boolean) => void
  importButtonTitle: string
  importCardTitle?: string
  children: ReactNode
  importCard?: ReactNode
  alert?: ReactNode
  onCancel: () => void
  onSubmit: () => void
  cancelLabel: string
  submitLabel: string
  submitDisabled: boolean
}

// Render the shared header (icon + title + import button) for customer sub-entity modals.
export default function SubEntityModalFrame({
  open, onClose, ariaLabel, persistKey, isEdit, title, subtitle, icon: Icon,
  iconColor, iconBg, importOpen, setImportOpen, importButtonTitle, importCardTitle,
  children, importCard, alert, onCancel, onSubmit, cancelLabel,
  submitLabel, submitDisabled,
}: SubEntityModalFrameProps) {
  return (
    <FloatingPanel open={open} onClose={onClose} ariaLabel={ariaLabel} persistKey={persistKey}
      scrollBody={false} width={`min(calc(100vw - 48px), ${WIDE_MODAL.maxWidth}px)`}
      maxWidth={`${WIDE_MODAL.maxWidth}px`}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color={iconColor} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
          </div>
          {/* K1b (2026-08-14): import affordance lives top-right in the header,
              never buried — mirrors AddCustomerModal. */}
          {!isEdit && (
            <Button type="button" variant="primary" onClick={() => setImportOpen(!importOpen)}
              aria-expanded={importOpen} style={{ gap: 6, marginLeft: 'auto' }}>
              {importButtonTitle}
            </Button>
          )}
        </div>
      }>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* K1b (2026-08-14): import flow renders as the first card while open. */}
        {importOpen && !isEdit && importCard && (
          <div style={{ ...cardBox, padding: 16 }}>
            {importCardTitle && <div style={cardHead}>{importCardTitle}</div>}
            {importCard}
          </div>
        )}
        {children}
      </div>

      {/* Server-side rejection (non-field 422 / other failure) — shown in place. */}
      {alert}

      <ModalFooter onCancel={onCancel} cancelLabel={cancelLabel}
        onSubmit={onSubmit} submitLabel={submitLabel} disabled={submitDisabled ? true : false} />
    </FloatingPanel>
  )
}
