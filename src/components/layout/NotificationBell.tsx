/**
 * NotificationBell — topbar bell next to the profile avatar. Shows a badge with
 * the unseen count (backend-driven, graceful/empty until the feed exists) and a
 * dropdown listing the notifications. Opening the panel marks everything seen so
 * the badge clears. Matches the filter-button styling.
 *
 * BEL-DOORKLIK: a row navigates to its record when the backend supplies a
 * resolvable target (`entity_type`/`entity_id`, a nested `meta.type`/`meta.id`,
 * or a ready-made `link`); a row with no such target stays non-interactive — no
 * fake affordance (§3, "no fake affordances"). Navigation reuses the app shell's
 * own hash-history contract (DashboardLayout's `goTo` + `useDrawerUrl`'s
 * `?open=<id>`) via `window.history.pushState` + a synthetic `popstate`, since
 * this component sits above `NavigationProvider` in the tree and has no direct
 * access to `goTo`/`openEntity`.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import type { AppNotification } from '@/hooks/useNotifications'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'

// Locale-aware short date-time for a notification row.
const fmt = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Backend entity-type slug → the app shell's page key (appPages.tsx PAGE_TITLES).
const ENTITY_PAGE: Record<string, string> = {
  candidate: 'candidates', lead: 'candidates', application: 'applications',
  vacancy: 'vacancies', match: 'matches', task: 'tasks',
  opportunity: 'opportunities', customer: 'customers',
}

export interface NotificationTarget { page: string; id: string }

// Pure: resolve a notification into a navigable {page, id}, or null when nothing
// on the row is a real target (a row with no target must stay non-clickable).
export function resolveNotificationTarget(n: AppNotification): NotificationTarget | null {
  const meta = (n as { meta?: { type?: string; id?: string | number } }).meta
  const type = meta?.type ?? (n as { entity_type?: string }).entity_type
  const rawId = meta?.id ?? (n as { entity_id?: string | number }).entity_id
  const page = type ? ENTITY_PAGE[type] : undefined
  if (page && rawId != null) return { page, id: String(rawId) }
  // Fall back to a same-app hash link the backend already resolved, e.g. "#tasks?open=42".
  const link = n.link
  if (link && link.startsWith('#')) {
    const raw = link.replace(/^#/, '')
    const [p, q] = raw.split('?')
    const id = q ? new URLSearchParams(q).get('open') : null
    if (p && id) return { page: p, id }
  }
  return null
}

// Impure: navigate to a resolved target via the shell's own hash-history
// contract (mirrors DashboardLayout's goTo + useDrawerUrl's writeOpenId), so the
// target page's own drawer-open effect (`?open=<id>`) picks it up unchanged.
function navigateToTarget(target: NotificationTarget) {
  const hash = `#${target.page}?open=${encodeURIComponent(target.id)}`
  const state = { kmPage: target.page, drawerOpen: target.id }
  window.history.pushState(state, '', hash)
  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}

export default function NotificationBell() {
  const { t } = useTranslation('common')
  const { items, unseen, markAllSeen } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close the panel on an outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (isInsideDropdownPortal(e.target as Node)) return; if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
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
          // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
          color: open ? 'var(--color-primary-text)' : 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        <Bell size={14} />
        {unseen > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            // Fixed danger fill needs its own on-danger token, never a raw hex.
            background: 'var(--color-danger)', color: 'var(--color-on-danger)',
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
            items.map((n, i) => {
              // A row navigates only when it carries a real, resolvable target.
              const target = resolveNotificationTarget(n)
              const clickable = target != null
              return (
                <div
                  key={n.id ?? i}
                  role="menuitem"
                  tabIndex={clickable ? 0 : -1}
                  onClick={clickable ? () => { navigateToTarget(target!); setOpen(false) } : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToTarget(target!); setOpen(false) } } : undefined}
                  style={{
                    padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 2,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: n.seen ? 400 : 600, color: 'var(--text)' }}>{n.title || '—'}</div>
                  {n.body && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(n.created_at)}</div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
