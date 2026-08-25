/**
 * notificationTarget — the ONE mapping from a raw notification row to a
 * navigable {page, id} target, shared by NotificationBell (row click-through)
 * and useNotifications (attention toasts) so both surfaces agree on what is
 * "resolvable". Extracted from NotificationBell.tsx (NOTIF-ATTENTION-V1) —
 * NotificationBell re-exports these for backward compatibility.
 */
import type { AppNotification } from '@/hooks/useNotifications'

// Backend entity-type slug → the app shell's page key (appPages.tsx PAGE_TITLES).
export const ENTITY_PAGE: Record<string, string> = {
  candidate: 'candidates', lead: 'candidates', application: 'applications',
  vacancy: 'vacancies', match: 'matches', task: 'tasks',
  opportunity: 'opportunities', customer: 'customers',
}

export interface NotificationTarget { page: string; id: string }

// NOTIF-PAYLOAD (CMBE 8f0fcdb8, app/Support/NotificationActionStatus.php): the only
// action_status values a workflow-run notification ever carries — 'cancelled'/no-run
// stay null server-side and never reach the FE. An unknown/unlisted value must render
// nothing rather than a raw un-translated string.
export const KNOWN_ACTION_STATUSES = ['done', 'pending', 'failed'] as const
export type KnownActionStatus = (typeof KNOWN_ACTION_STATUSES)[number]

// Parse the backend-resolved hash deep link ("#candidates?open=42" or
// "/#candidates?open=42") into {page, id} — mirrors the existing same-app
// link fallback below, reused so both paths agree on the shape.
function parseHashTarget(url: string): NotificationTarget | null {
  const hashIdx = url.indexOf('#')
  if (hashIdx === -1) return null
  const raw = url.slice(hashIdx + 1)
  const [page, query] = raw.split('?')
  const id = query ? new URLSearchParams(query).get('open') : null
  return page && id ? { page, id } : null
}

// NOTIF-CONTEXTEN-FE-1 (CMBE 23-08): calllist/opportunity notifications carry
// their own `data.type` (not the generic meta.type/meta.id pointer) plus a
// custom meta shape — campaign_id for a call-list assignment, opportunity_id
// for a won/lost deal — so each type resolves its own target from meta below,
// checked before the generic meta.type/entity_type path.
// BEL-ACTIE-VANDAAG-1 (CMBE K-156): appointment.today carries { appointment_id,
// candidate_id, at } — no agenda/appointments page exists yet (grepped
// appPages/registry), so the deep-link goes to the candidate's drawer, same as
// every other candidate-anchored notification.
export const CUSTOM_TYPE_TARGETS: Record<string, (meta: Record<string, unknown>) => NotificationTarget | null> = {
  'calllist.target_assigned': (meta) => (meta.campaign_id != null ? { page: 'outreach', id: String(meta.campaign_id) } : null),
  'opportunity.won': (meta) => (meta.opportunity_id != null ? { page: 'opportunities', id: String(meta.opportunity_id) } : null),
  'opportunity.lost': (meta) => (meta.opportunity_id != null ? { page: 'opportunities', id: String(meta.opportunity_id) } : null),
  'appointment.today': (meta) => (meta.candidate_id != null ? { page: 'candidates', id: String(meta.candidate_id) } : null),
}

// Pure: resolve a notification into a navigable {page, id}, or null when nothing
// on the row is a real target (a row with no target must stay non-clickable).
export function resolveNotificationTarget(n: AppNotification): NotificationTarget | null {
  // NOTIF-PAYLOAD (CMBE 8f0fcdb8, app/Support/NotificationTarget.php +
  // app/Http/Controllers/NotificationController.php `url`): the backend now
  // resolves a click-through target for every row server-side, from the SAME
  // controlled entity vocabulary it already owns — prefer it over the local
  // fallbacks below so the FE never drifts from the backend's own mapping.
  // A row the backend could not resolve carries entity_type=null, url='/'
  // and must stay non-clickable (never parsed as a target).
  const serverUrl = (n as { url?: string | null }).url
  const serverEntityType = (n as { entity_type?: string | null }).entity_type
  if (serverUrl && serverUrl !== '/' && serverEntityType != null) {
    const parsed = parseHashTarget(serverUrl)
    if (parsed) return parsed
  }
  const meta = (n as { meta?: Record<string, unknown> }).meta ?? {}
  const dataType = (n as { type?: string }).type
  // Object.hasOwn (not `in`/bracket lookup alone) so a `type` of 'constructor'/
  // 'toString' can never resolve through Object.prototype (SETTINGS-TABS-FIX-1
  // review — a plain object literal let those two names return a truthy
  // non-target, e.g. navigation to '#undefined?open=undefined').
  const customTarget = dataType && Object.hasOwn(CUSTOM_TYPE_TARGETS, dataType)
    ? CUSTOM_TYPE_TARGETS[dataType](meta)
    : undefined
  if (customTarget) return customTarget
  const type = (meta.type as string | undefined) ?? (n as { entity_type?: string }).entity_type
  const rawId = (meta.id as string | number | undefined) ?? (n as { entity_id?: string | number }).entity_id
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
export function navigateToNotificationTarget(target: NotificationTarget) {
  const hash = `#${target.page}?open=${encodeURIComponent(target.id)}`
  const state = { kmPage: target.page, drawerOpen: target.id }
  window.history.pushState(state, '', hash)
  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}

// The same-origin hash deep link EntityLink uses for its own new-tab icon —
// shared here so an attention toast's trailing icon opens the exact same URL.
export function buildNotificationDeepLink(target: NotificationTarget): string {
  return `${window.location.pathname}#${target.page}?open=${encodeURIComponent(target.id)}`
}

export interface NotificationActionLine { status: KnownActionStatus; nextAction: string | null }

// Pure: resolve a workflow-run row's {action_status, next_action} into a
// renderable pair, or null when there is nothing to show (no run behind the
// row, or an unrecognized status — never render a raw, un-translated value).
export function resolveActionLine(n: AppNotification): NotificationActionLine | null {
  const status = (n as { action_status?: string | null }).action_status
  if (!status || !(KNOWN_ACTION_STATUSES as readonly string[]).includes(status)) return null
  const nextAction = (n as { next_action?: string | null }).next_action ?? null
  return { status: status as KnownActionStatus, nextAction }
}
