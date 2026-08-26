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
 *
 * NOTIF-ATTENTION-V1: the target-resolution logic now lives in the shared
 * `./notificationTarget` module (useNotifications' attention toasts use the
 * SAME mapping) — re-exported here so existing imports/tests are unaffected.
 * A row that resolves to a target also renders the EntityLink-style trailing
 * new-tab icon, opening that record's deep link in a new tab.
 */
import { useState, useRef, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { Bell, ExternalLink } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
// PORTAL-MARKER-1: a click inside an open portalled picker menu is never "outside".
import { isInsideDropdownPortal } from '@/lib/useDropdownPlacement'
import { SectionTitle, BodyText, Caption } from '@/components/ui/typography'
import Button from '@/components/ui/Button'
import {
  resolveNotificationTarget, navigateToNotificationTarget, buildNotificationDeepLink, resolveActionLine,
} from './notificationTarget'
import type { NotificationTarget } from './notificationTarget'

// Re-exported for backward compatibility (existing imports/tests reach these
// through NotificationBell); the single source of truth is ./notificationTarget.
// eslint-disable-next-line react-refresh/only-export-components -- pure helper re-export co-located with its one caller; HMR-nicety warning only
export { resolveNotificationTarget }
export type { NotificationTarget }

// Topbar bell + dropdown; opening it marks everything seen, and each row deep-links to its record only when the backend supplies a resolvable target (see file header).
export default function NotificationBell() {
  const { t } = useTranslation('common')
  // DATUM-1: rows read DD-MM-YYYY HH:mm through the house formatter — never a
  // hand-built toLocaleString (naronde wave-B1; the local fmt helper is gone).
  const { formatDateTime } = useDateFormat()
  const fmt = (iso?: string) => (iso ? formatDateTime(iso) : '')
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
      {/* HUISSTIJL-1 (Opus-F residual triage, judged — LEFT tinted, not trio):
          a calm topbar utility icon (mirrors ChangelogPopover/VariablePicker's
          own identical muted-idle -> primary-tint-while-open pattern), not an
          accent call-to-action like ActionMenu's "+ actions" trigger — solid-
          filling only the bell would fight its own sibling precedent, and an
          always-coloured icon in the global topbar reads as decoration (§4). */}
      <button
        onClick={toggle}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        className="flex items-center justify-center transition-colors rounded-lg"
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- topbar icon toggle with its own open-state colour swap (mirrors ChangelogPopover/VariablePicker), not one of Button's fixed variants
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
        // HUISSTIJL-1: dropdown panel — z-popover ladder tier, shadow-float role.
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 38, width: 360, maxHeight: 420, overflowY: 'auto', zIndex: 'var(--z-popover)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: 'var(--shadow-float)',
        }}>
          <SectionTitle style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            {t('notifications.title')}
          </SectionTitle>
          {items.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('notifications.empty')}
            </div>
          ) : (
            items.map((n, i) => {
              // A row navigates only when it carries a real, resolvable target.
              const target = resolveNotificationTarget(n)
              const clickable = target != null
              // NOTIF-PAYLOAD: a workflow-run row also shows its status + next step.
              const action = resolveActionLine(n)
              return (
                <div
                  key={n.id ?? i}
                  role="menuitem"
                  tabIndex={clickable ? 0 : -1}
                  onClick={clickable ? () => { navigateToNotificationTarget(target!); setOpen(false) } : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToNotificationTarget(target!); setOpen(false) } } : undefined}
                  style={{
                    padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <BodyText style={{ fontWeight: n.seen ? 400 : 600 }}>{n.title || '—'}</BodyText>
                    {n.body && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.body}</div>}
                    {action && (
                      // K-192: next_action is a KEY, rendered only for the two known
                      // keys — an unknown/null key shows the status line alone.
                      <Caption>
                        {t(`notifications.actionStatus.${action.status}`)}{action.nextAction ? ` ${t(`notifications.nextAction.${action.nextAction}`)}` : ''}
                      </Caption>
                    )}
                    <Caption>{fmt(n.created_at)}</Caption>
                  </div>
                  {/* EntityLink idiom: the row name navigates in-app, this icon opens
                      the same record's deep link in a new browser tab. */}
                  {clickable && (
                    <Button href={buildNotificationDeepLink(target!)} target="_blank" rel="noopener noreferrer"
                      onClick={(e: ReactMouseEvent) => e.stopPropagation()} variant="ghost" iconOnly size="sm"
                      title={t('openInNewTab')} aria-label={t('openInNewTab')}
                      style={{ flexShrink: 0, opacity: 0.65, marginTop: 2 }}>
                      <ExternalLink size={12} />
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
