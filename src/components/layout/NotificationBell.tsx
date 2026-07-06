/**
 * NotificationBell — topbar bell next to the profile avatar. Shows a badge with
 * the unseen count (backend-driven, graceful/empty until the feed exists) and a
 * dropdown listing the notifications. Opening the panel marks everything seen so
 * the badge clears. Matches the filter-button styling.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'

// Locale-aware short date-time for a notification row.
const fmt = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationBell() {
  const { t } = useTranslation('common')
  const { items, unseen, markAllSeen } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close the panel on an outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Toggle open; opening with unseen items marks them seen.
  const toggle = () => setOpen(o => { const next = !o; if (next && unseen) markAllSeen(); return next })
  const badge = unseen > 9 ? '9+' : String(unseen)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        className="flex items-center justify-center transition-colors rounded-lg"
        style={{
          position: 'relative', width: 30, height: 30,
          background: open ? 'var(--color-primary-bg)' : 'var(--hover-bg)',
          border: `1px solid ${open ? 'var(--color-primary)' : 'var(--border)'}`,
          color: open ? 'var(--color-primary)' : 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        <Bell size={14} />
        {unseen > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: 'var(--color-danger)', color: '#fff',
            borderRadius: 999, fontSize: 10, fontWeight: 700,
            minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
          }}>
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 38, width: 360, maxHeight: 420, overflowY: 'auto', zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {t('notifications.title')}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('notifications.empty')}
            </div>
          ) : (
            items.map((n, i) => (
              <div key={n.id ?? i} role="menuitem" style={{
                padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div style={{ fontSize: 13, fontWeight: n.seen ? 400 : 600, color: 'var(--text)' }}>{n.title || '—'}</div>
                {n.body && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
