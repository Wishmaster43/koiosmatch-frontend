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

// `hash` (LIMIET-MONITOR-1): a settings deep link ("#settings/<group>/<tab>") — those
// screens have no `?open=<id>` drawer, so the raw hash IS the target.
export interface NotificationTarget { page: string; id: string; intent?: Record<string, unknown>; hash?: string }

// NOTIF-PAYLOAD (CMBE 8f0fcdb8, app/Support/NotificationActionStatus.php): the only
// action_status values a workflow-run notification ever carries — 'cancelled'/no-run
// stay null server-side and never reach the FE. An unknown/unlisted value must render
// nothing rather than a raw un-translated string.
const KNOWN_ACTION_STATUSES = ['done', 'pending', 'failed'] as const
export type KnownActionStatus = (typeof KNOWN_ACTION_STATUSES)[number]

// K-192: next_action is now a KEY, not prose — the only two values a workflow-run
// notification ever carries (NotificationActionStatus::fromRunStatus, backend).
// An unknown/unlisted value must render nothing, never the raw key.
const KNOWN_NEXT_ACTIONS = ['auto_processing', 'check_followup_task'] as const
export type KnownNextAction = (typeof KNOWN_NEXT_ACTIONS)[number]

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
  // K-248 PROPOSE-SEND-1: a failed proposal send bells the proposer — meta
  // carries application_id (ProposalService::notifySendFailed) alongside the
  // generic meta.type/id pointer, so this is belt-and-braces with the generic path.
  'proposal.send_failed': (meta) => (meta.application_id != null ? { page: 'applications', id: String(meta.application_id) } : null),
  // MATCH-APPROVAL-2: a match pending approval notification (MatchApprovalTasks.php)
  // carries match_id in meta and navigates to the match drawer with the pending-approval
  // quick view activated (intent: { pendingApprovalOnly: true }).
  'match.approval_pending': (meta) => (meta.match_id != null ? { page: 'matches', id: String(meta.match_id), intent: { pendingApprovalOnly: true } } : null),
  // LIMIET-MONITOR-1: a connector limit warning opens the tenant's limits tab
  // (scope tenant) or the super-admin platform limits section (scope platform).
  'connector.limit_warning': (meta) => {
    const scope = meta.scope as string | undefined
    if (scope === 'tenant') return { page: 'settings', id: 'limits', hash: '#settings/integrations/limits' }
    if (scope === 'platform') return { page: 'settings', id: 'admin_limits', hash: '#settings/superadmin/admin_limits' }
    return null
  },
  // LIMITS-FE-F7 (limits:check 'blocked' level, ConnectorGate): a real refusal/
  // queue today — two distinct types, each pointing at ITS OWN limits screen
  // (never `scope`-branched like the warning above: the tenant-facing type
  // never reaches a super-admin viewer and vice versa).
  'connector.limit_blocked': () => ({ page: 'settings', id: 'limits', hash: '#settings/integrations/limits' }),
  'connector.limit_blocked_platform': () => ({ page: 'settings', id: 'admin_limits', hash: '#settings/superadmin/admin_limits' }),
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
  // Fall back to a same-app hash link the backend already resolved, e.g. "#tasks?open=42" —
  // reuses parseHashTarget so both paths genuinely share the parse (D1 audit fix).
  return n.link ? parseHashTarget(n.link) : null
}

// Impure: navigate to a resolved target via the shell's own hash-history
// contract (mirrors DashboardLayout's goTo + useDrawerUrl's writeOpenId), so the
// target page's own drawer-open effect (`?open=<id>`) picks it up unchanged.
// When the target carries optional intent data (e.g., MATCH-APPROVAL-2's
// pendingApprovalOnly), it is passed to DashboardLayout via the state so the
// page receives it as the navIntent prop.
export function navigateToNotificationTarget(target: NotificationTarget) {
  // A settings deep link rides the shell's own hash routing (same as the sidebar's
  // anchors); re-dispatching hashchange covers the "already on that hash" case.
  if (target.hash) {
    window.location.hash = target.hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  const hash = `#${target.page}?open=${encodeURIComponent(target.id)}`
  const state: Record<string, unknown> = { kmPage: target.page, drawerOpen: target.id }
  if (target.intent != null) state.kmIntentData = target.intent
  window.history.pushState(state, '', hash)
  window.dispatchEvent(new PopStateEvent('popstate', { state: { ...state, kmSynthetic: true } }))
}

// The same-origin hash deep link EntityLink uses for its own new-tab icon —
// shared here so an attention toast's trailing icon opens the exact same URL.
export function buildNotificationDeepLink(target: NotificationTarget): string {
  if (target.hash) return `${window.location.pathname}${target.hash}`
  return `${window.location.pathname}#${target.page}?open=${encodeURIComponent(target.id)}`
}

// TRANSFER-FAMILIES ZIP: notification types whose click-through is an EXTERNAL
// signed URL (meta.download_url), not a record target — resolved separately so
// the {page,id} model stays untouched. Only http(s) strings pass; anything else
// leaves the row non-clickable (§3 no fake affordances).
const CUSTOM_HREF_TYPES: Record<string, (meta: Record<string, unknown>) => string | null> = {
  'documents.zip_ready': (meta) =>
    typeof meta.download_url === 'string' && /^https?:\/\//i.test(meta.download_url) ? meta.download_url : null,
}

// Pure: resolve a notification whose target is an external download link, or null.
export function resolveNotificationHref(n: AppNotification): string | null {
  const dataType = (n as { type?: string }).type
  if (!dataType || !Object.hasOwn(CUSTOM_HREF_TYPES, dataType)) return null
  const meta = (n as { meta?: Record<string, unknown> }).meta ?? {}
  return CUSTOM_HREF_TYPES[dataType](meta)
}

export interface NotificationActionLine { status: KnownActionStatus; nextAction: KnownNextAction | null }

// Pure: resolve a workflow-run row's {action_status, next_action} into a
// renderable pair, or null when there is nothing to show (no run behind the
// row, or an unrecognized status — never render a raw, un-translated value).
// next_action is a KEY (K-192); an unknown key is dropped, never rendered raw.
export function resolveActionLine(n: AppNotification): NotificationActionLine | null {
  const status = (n as { action_status?: string | null }).action_status
  if (!status || !(KNOWN_ACTION_STATUSES as readonly string[]).includes(status)) return null
  const rawNextAction = (n as { next_action?: string | null }).next_action
  const nextAction = rawNextAction && (KNOWN_NEXT_ACTIONS as readonly string[]).includes(rawNextAction)
    ? (rawNextAction as KnownNextAction) : null
  return { status: status as KnownActionStatus, nextAction }
}

// Pure: extract the Koios prompt from a notification row if it carries a non-empty
// string; return null when koios_action is missing, null, or the prompt is empty.
export function koiosPromptOf(n: AppNotification): string | null {
  const koiosAction = (n as { koios_action?: { prompt: string } | null }).koios_action
  if (!koiosAction) return null
  const prompt = koiosAction.prompt?.trim()
  return prompt ? prompt : null
}
