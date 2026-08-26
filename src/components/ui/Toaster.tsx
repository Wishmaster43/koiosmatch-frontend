/**
 * Toaster — global host for `km:toast` events (see lib/notify). Renders queued
 * toasts bottom-right, auto-expiring, dismissible. Token-styled (light/dark) and
 * accessible: role=alert for errors, role=status otherwise; labelled close button.
 *
 * NOTIF-ATTENTION-V1: a toast may additionally carry a bold `title`, an in-app
 * `onOpen` click surface (the whole toast body, keyboard-operable), and a
 * trailing new-tab icon anchor when `deepLink` is set (mirrors EntityLink's
 * name-click=in-app / icon-click=new-tab idiom). `duration` overrides the
 * default 5s auto-dismiss for toasts that need more attention (e.g. 10s).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertTriangle, CheckCircle, Info, ExternalLink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToastType } from '@/lib/notify'
import Button from './Button'
import { SectionTitle, Caption } from './typography'

interface Toast { id: number; type: ToastType; message: string; title?: string; onOpen?: () => void; deepLink?: string; duration?: number; actionLine?: string }

const ICON: Record<ToastType, LucideIcon> = { error: AlertTriangle, success: CheckCircle, info: Info }
const COLOR: Record<ToastType, string> = { error: 'var(--color-danger)', success: 'var(--color-success)', info: 'var(--color-info)' }
const DEFAULT_DURATION = 5000

// Global toast host (see file docblock above): listens for `km:toast` events and
// renders the queue bottom-right, each auto-expiring on its own timer.
export default function Toaster() {
  const { t } = useTranslation('common')
  const [toasts, setToasts] = useState<Toast[]>([])
  const remove = useCallback((id: number) => setToasts(ts => ts.filter(x => x.id !== id)), [])

  // Subscribe to global toast events; each toast auto-dismisses after its duration (default 5s).
  useEffect(() => {
    // A `km:toast` CustomEvent arrived (via lib/notify): queues it and schedules
    // its own auto-dismiss.
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<Omit<Toast, 'id'>>).detail
      const id = Date.now() + Math.random()
      const toast: Toast = { ...detail, id }
      setToasts(ts => [...ts, toast])
      setTimeout(() => remove(id), toast.duration ?? DEFAULT_DURATION)
    }
    window.addEventListener('km:toast', onToast)
    return () => window.removeEventListener('km:toast', onToast)
  }, [remove])

  if (toasts.length === 0) return null

  return (
    // HUISSTIJL-1: notifications sit at the top of the z-ladder, always above drawers/modals/popovers.
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 'var(--z-toast)', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      {toasts.map(toast => {
        const Icon = ICON[toast.type]
        const clickable = !!toast.onOpen
        // The body acts in-app (click/Enter/Space) exactly like EntityLink's name click;
        // the trailing icon (when a deepLink exists) is a real anchor opening a new tab.
        const openInApp = () => { toast.onOpen?.(); remove(toast.id) }
        return (
          <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10,
              background: 'var(--surface)', border: `1px solid ${COLOR[toast.type]}`,
              boxShadow: 'var(--shadow-float)', color: 'var(--text)' }}>
            <Icon size={16} color={COLOR[toast.type]} style={{ flexShrink: 0, marginTop: 1 }} />
            {/* §6: the wrapper stays the announcing live region; opening in-app is
                a REAL button around the text (semantic control, no role clash). */}
            {clickable ? (
              <button type="button" onClick={openInApp}
                aria-label={toast.title ?? toast.message}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- NECESSITY: unstyled text-button wrapper inside the toast; identity (colors/border) stays on the toast itself, Button's chrome would double-frame the text
                style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
                {toast.title && <SectionTitle style={{ marginBottom: 2 }}>{toast.title}</SectionTitle>}
                <span style={{ fontSize: 13 }}>{toast.message}</span>
                {toast.actionLine && <Caption style={{ marginTop: 2 }}>{toast.actionLine}</Caption>}
              </button>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                {toast.title && <SectionTitle style={{ marginBottom: 2 }}>{toast.title}</SectionTitle>}
                <span style={{ fontSize: 13 }}>{toast.message}</span>
                {toast.actionLine && <Caption style={{ marginTop: 2 }}>{toast.actionLine}</Caption>}
              </div>
            )}
            {toast.deepLink && (
              // Button's polymorphic href variant: a link that looks like an icon
              // button stays a real <a> (new tab) while sharing the house identity.
              <Button href={toast.deepLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                variant="ghost" iconOnly size="sm" aria-label={t('openInNewTab')} title={t('openInNewTab')}
                style={{ flexShrink: 0, opacity: 0.65 }}>
                <ExternalLink size={13} />
              </Button>
            )}
            <Button onClick={e => { e.stopPropagation(); remove(toast.id) }}
              variant="ghost" iconOnly size="sm" aria-label={t('close', { defaultValue: 'Close' })}
              style={{ flexShrink: 0 }}>
              <X size={14} />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
