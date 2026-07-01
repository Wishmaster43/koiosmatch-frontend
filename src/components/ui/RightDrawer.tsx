/**
 * RightDrawer — generic slide-in panel anchored to the right, for drill-downs.
 * Dumb shell: backdrop + focus-trapped panel + header (title/subtitle/close) +
 * scrollable body. Callers render their own content as children. Reusable across
 * the app (KPI drill-downs, detail peeks) so we don't re-implement drawer chrome.
 */
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function RightDrawer({ title, subtitle, onClose, width = 480, children }: {
  title?: ReactNode; subtitle?: ReactNode; onClose: () => void; width?: number; children?: ReactNode
}) {
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const { t } = useTranslation('common')
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />

      {/* Panel */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
        className="fixed top-0 bottom-0 right-0 z-50 flex flex-col"
        style={{ width, maxWidth: '92vw', background: 'var(--surface)', boxShadow: '-4px 0 30px rgba(0,0,0,0.12)' }}>
        <div className="flex items-start justify-between flex-shrink-0" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label={t('close')}
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: 12, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto" style={{ padding: 16 }}>{children}</div>
      </div>
    </>
  )
}
