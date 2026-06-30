/**
 * Toaster — global host for `km:toast` events (see lib/notify). Renders queued
 * toasts bottom-right, auto-expiring, dismissible. Token-styled (light/dark) and
 * accessible: role=alert for errors, role=status otherwise; labelled close button.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ToastType } from '@/lib/notify'

interface Toast { id: number; type: ToastType; message: string }

const ICON: Record<ToastType, LucideIcon> = { error: AlertTriangle, success: CheckCircle, info: Info }
const COLOR: Record<ToastType, string> = { error: 'var(--color-danger)', success: 'var(--color-success)', info: 'var(--color-info)' }

export default function Toaster() {
  const { t } = useTranslation('common')
  const [toasts, setToasts] = useState<Toast[]>([])
  const remove = useCallback((id: number) => setToasts(ts => ts.filter(x => x.id !== id)), [])

  // Subscribe to global toast events; each toast auto-dismisses after 5s.
  useEffect(() => {
    const onToast = (e: Event) => {
      const { type, message } = (e as CustomEvent<{ type: ToastType; message: string }>).detail
      const id = Date.now() + Math.random()
      setToasts(ts => [...ts, { id, type, message }])
      setTimeout(() => remove(id), 5000)
    }
    window.addEventListener('km:toast', onToast)
    return () => window.removeEventListener('km:toast', onToast)
  }, [remove])

  if (toasts.length === 0) return null

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
      {toasts.map(toast => {
        const Icon = ICON[toast.type]
        return (
          <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              background: 'var(--surface)', border: `1px solid ${COLOR[toast.type]}`,
              boxShadow: '0 6px 24px rgba(0,0,0,0.12)', color: 'var(--text)' }}>
            <Icon size={16} color={COLOR[toast.type]} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13 }}>{toast.message}</span>
            <button onClick={() => remove(toast.id)} aria-label={t('close', { defaultValue: 'Close' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
