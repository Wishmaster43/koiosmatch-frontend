/**
 * ReportDrawerChrome — shared header/body chrome for all report detail drawers.
 * Renders: fixed overlay + right-side panel with header (icon+title+close button) and scrollable body.
 * Manages focus trap and escapes; content injected via children.
 */
import { ReactNode } from 'react'
import { X } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useTranslation } from 'react-i18next'

interface ReportDrawerChromeProps {
  title: string
  onClose: () => void
  headerIcon?: ReactNode
  headerMeta?: ReactNode
  children: ReactNode
}

export default function ReportDrawerChrome({
  title,
  onClose,
  headerIcon,
  headerMeta,
  children,
}: ReportDrawerChromeProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation()

  return (
    <>
      <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.25)', zIndex: 'var(--z-drawer)' }} onClick={onClose} />

      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 flex flex-col bg-[var(--surface)]"
        style={{ width: 420, zIndex: 'var(--z-drawer)', boxShadow: 'var(--shadow-drawer)' }}>

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
            <Button variant="ghost" iconOnly onClick={onClose} aria-label={t('common:close')}
              style={{ marginLeft: 10, flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <X size={15} />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {children}
        </div>
      </div>
    </>
  )
}
