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
 *
 * NOTIF-I18N-1 (Danny 29-09, bell review as Kelly, EN): each row now renders in
 * the VIEWING USER's language, names the record it is about, offers the same
 * executable actions a Koios suggestion row does, and can be removed — see
 * `./NotificationRow`. The per-row trash button and the header "mark all read"
 * button render only once the backend payload is the new shape (feature
 * detection on `record`/`title_key`/`actions`), so an older backend never shows
 * a dead affordance.
 */
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDateFormat } from '@/lib/datetime'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useClickOutside } from '@/hooks/useClickOutside'
import { SectionTitle } from '@/components/ui/typography'
import NotificationRow from './NotificationRow'
import { resolveNotificationTarget } from './notificationTarget'
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
  const { items, unseen, markAllSeen, removeNotification } = useNotifications()
  // NOTIF-I18N-1: feature-detect the new payload shape — a row carrying `record`
  // or `title_key` (present, even null) means the backend sends the new fields,
  // so the trash/read-all affordances are real; an older backend never shows them.
  const newShape = items.some(n => Object.hasOwn(n, 'record') || Object.hasOwn(n, 'title_key'))
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useFocusTrap<HTMLDivElement>(() => setOpen(false))

  // Close the panel on an outside click (DRY round 11, LAYOUT).
  useClickOutside([ref], open, () => setOpen(false), { ignoreDropdownPortal: true })

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
        // HUISSTIJL-1: dropdown panel — z-popover ladder tier, shadow-float role. Non-modal on
        // purpose (outside click still closes it, nothing else is inerted), so no aria-modal.
        <div ref={panelRef} role="dialog" aria-label={t('notifications.title')} tabIndex={-1} style={{
          position: 'absolute', right: 0, top: 38, width: 360, maxHeight: 420, overflowY: 'auto', zIndex: 'var(--z-popover)',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: 'var(--shadow-float)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
          }}>
            <SectionTitle>{t('notifications.title')}</SectionTitle>
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('notifications.empty')}
            </div>
          ) : (
            items.map((n, i) => (
              <NotificationRow
                key={n.id ?? i}
                n={n}
                isLast={i === items.length - 1}
                fmt={fmt}
                showRemove={newShape}
                onRemove={removeNotification}
                onClose={() => setOpen(false)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
