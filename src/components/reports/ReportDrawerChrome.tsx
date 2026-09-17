/**
 * ReportDrawerChrome — shared header/body chrome for all report detail drawers.
 * Renders: fixed overlay + right-side panel with header (icon+title+close button) and scrollable body.
 * Manages focus trap and escapes; content injected via children.
 */
import { ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'
import DrawerCloseButton from '@/components/drawer/DrawerCloseButton'
import DrawerBackdrop from '@/components/drawer/DrawerBackdrop'

interface ReportDrawerChromeProps {
  title: string
  // Stacking level: the house drawer band by default; a caller inside a modal passes the modal's own level.
  zIndex?: number | string
  onClose: () => void
  headerIcon?: ReactNode
  headerMeta?: ReactNode
  children: ReactNode
  // Panel width in px — the house 420 by default; a caller with wider body
  // content (e.g. a customer's locations/departments list) can widen it.
  width?: number
  // Optional footer slot (border-top + hover-bg band), e.g. a single Close action.
  footer?: ReactNode
}

export default function ReportDrawerChrome({
  title,
  onClose,
  headerIcon,
  headerMeta,
  children,
  zIndex = 'var(--z-drawer)',
  width = 420,
  footer,
}: ReportDrawerChromeProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation()

  return (
    <>
      <DrawerBackdrop onClick={onClose} zIndex={zIndex} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width, zIndex, boxShadow: 'var(--shadow-drawer)' }}>

        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              {headerIcon && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {headerIcon}
                </div>
              )}
              {headerMeta}
            </div>
            <DrawerCloseButton onClick={onClose} ariaLabel={t('common:close')} style={{ marginLeft: 10, flexShrink: 0 }} />
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {children}
        </div>

        {/* Optional footer slot */}
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 18px',
                        borderTop: '1px solid var(--border)', background: 'var(--hover-bg)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
