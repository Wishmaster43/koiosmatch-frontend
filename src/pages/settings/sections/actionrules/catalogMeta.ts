/**
 * catalogMeta — the FIXED vocabulary + seed-default effects of the action×condition
 * catalog (mirrors `app/Services/ActionRules/ActionRuleCatalog.php::defaults()` byte
 * for byte, koiosmatch-api read-only per this task's file boundary). This is NOT a
 * tenant lookup (§3B "never hardcoded") — it is fixed engineering metadata describing
 * a catalog the backend itself hardcodes; there is no CRUD for the action/condition
 * TOKENS themselves, only for each cell's `effect`.
 *
 * KNOWN GAP (measured, see report): `GET /action-rules` returns only
 * {action, condition, effect, popup_code} — no `is_override` flag and no
 * `default_effect`. DEFAULT_EFFECTS below is the only way this screen can show an
 * "overridden vs default" badge; if the backend catalog ever changes, this file must
 * be updated too. Recommended follow-up: have the backend add `is_override` (and
 * ideally `default_effect`) to the GET row so the frontend never needs its own copy.
 */
import type { Effect } from './types'
import { cellKey } from './types'

// §B — candidate axis action tokens, in the catalog's own ACTIONS_CANDIDATE order.
export const CANDIDATE_ACTIONS = [
  'application.create', 'application.couple_vacancy', 'appointment.create', 'match.create',
  'task.create', 'calllist.add', 'whatsapp.send', 'candidate.propose',
  'candidate.status_set', 'candidate.sync',
] as const

// §C — customer axis action tokens (task.create is SHARED with §B — one action, two axes).
export const CUSTOMER_ACTIONS = [
  'opportunity.create', 'vacancy.create', 'customer.match', 'task.create', 'customer.propose',
] as const

// §B condition tokens — one column per candidate deployability condition.
export const CANDIDATE_CONDITIONS = [
  'lead', 'available', 'temporarily_unavailable', 'placed', 'blacklist', 'archived',
] as const

// §C condition tokens — one column per customer status.
export const CUSTOMER_CONDITIONS = ['active', 'inactive', 'blocked'] as const

// The cross-cutting AVG gate: only ever evaluated for whatsapp.send (never its own column
// in the main 6-column grid — rendered as its own one-row section instead, §B "— zonder consent").
export const WHATSAPP_SEND_ACTION = 'whatsapp.send'
export const NO_CONSENT_CONDITION = 'whatsapp.no_consent'

// i18n key suffix per action token (settings.json → actionRules.actions.<key>).
export const ACTION_I18N_KEY: Record<string, string> = {
  'application.create': 'application_create',
  'application.couple_vacancy': 'application_couple_vacancy',
  'appointment.create': 'appointment_create',
  'match.create': 'match_create',
  'task.create': 'task_create',
  'calllist.add': 'calllist_add',
  'whatsapp.send': 'whatsapp_send',
  'candidate.propose': 'candidate_propose',
  'candidate.status_set': 'candidate_status_set',
  'candidate.sync': 'candidate_sync',
  'opportunity.create': 'opportunity_create',
  'vacancy.create': 'vacancy_create',
  'customer.match': 'customer_match',
  'customer.propose': 'customer_propose',
}

// i18n key suffix per condition token (settings.json → actionRules.conditions.<key>).
export const CONDITION_I18N_KEY: Record<string, string> = {
  lead: 'lead', available: 'available', temporarily_unavailable: 'temporarily_unavailable',
  placed: 'placed', blacklist: 'blacklist', archived: 'archived',
  'whatsapp.no_consent': 'whatsapp_no_consent',
  active: 'active', inactive: 'inactive', blocked: 'blocked',
}

// Every popup code the catalog can emit, in display order (for the legend).
export const POPUP_CODES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'] as const

// The seed-default effect per cell — transcribed verbatim from ActionRuleCatalog::defaults().
// Shorthand: a bare Effect means every condition in that axis shares it; an array gives
// one Effect per condition, in the same order as CANDIDATE_CONDITIONS/CUSTOMER_CONDITIONS.
const CANDIDATE_DEFAULTS: Record<string, Effect[]> = {
  'application.create': ['allow', 'allow', 'warn', 'warn', 'block', 'block'],
  'application.couple_vacancy': ['allow', 'allow', 'allow', 'warn', 'block', 'block'],
  'appointment.create': ['allow', 'allow', 'warn', 'warn', 'block', 'block'],
  'match.create': ['warn', 'allow', 'warn', 'warn', 'block', 'block'],
  'task.create': ['allow', 'allow', 'allow', 'allow', 'warn', 'block'],
  'calllist.add': ['allow', 'allow', 'warn', 'warn', 'block', 'block'],
  'whatsapp.send': ['allow', 'allow', 'warn', 'warn', 'block', 'block'],
  'candidate.propose': ['warn', 'allow', 'warn', 'warn', 'block', 'block'],
  'candidate.status_set': ['allow', 'allow', 'allow', 'allow', 'allow', 'block'],
  'candidate.sync': ['allow', 'allow', 'allow', 'allow', 'warn', 'block'],
}
const CUSTOMER_DEFAULTS: Record<string, Effect[]> = {
  'opportunity.create': ['allow', 'warn', 'block'],
  'vacancy.create': ['allow', 'warn', 'block'],
  'customer.match': ['allow', 'warn', 'block'],
  'task.create': ['allow', 'allow', 'warn'],
  'customer.propose': ['allow', 'warn', 'block'],
}

// The fixed popup code per cell (catalog metadata, never tenant-editable — mirrors popupCode()).
const CANDIDATE_POPUPS: Record<string, (string | null)[]> = {
  'application.create': [null, null, 'P1', 'P2', 'P3', 'P4'],
  'application.couple_vacancy': [null, null, null, 'P2', 'P3', 'P4'],
  'appointment.create': [null, null, 'P1', 'P2', 'P3', 'P4'],
  'match.create': ['P5', null, 'P1', 'P6', 'P3', 'P4'],
  'task.create': [null, null, null, null, 'P7', 'P4'],
  'calllist.add': [null, null, 'P1', 'P2', 'P3', 'P4'],
  'whatsapp.send': [null, null, 'P1', 'P2', 'P3', 'P4'],
  'candidate.propose': ['P5', null, 'P1', 'P2', 'P3', 'P4'],
  'candidate.status_set': [null, null, null, null, null, 'P4'],
  'candidate.sync': [null, null, null, null, 'P7', 'P4'],
}
const CUSTOMER_POPUPS: Record<string, (string | null)[]> = {
  'opportunity.create': [null, 'P9', 'P10'],
  'vacancy.create': [null, 'P9', 'P10'],
  'customer.match': [null, 'P9', 'P10'],
  'task.create': [null, null, 'P9'],
  'customer.propose': [null, 'P9', 'P10'],
}

// Flatten the per-axis tables above into one DEFAULT_EFFECTS / POPUP_CODE_BY_CELL map,
// keyed the same way ActionRuleController::index() keys its overrides.
const DEFAULT_EFFECTS: Record<string, Effect> = {}
const POPUP_CODE_BY_CELL: Record<string, string | null> = {}
for (const action of CANDIDATE_ACTIONS) {
  CANDIDATE_CONDITIONS.forEach((condition, i) => {
    DEFAULT_EFFECTS[cellKey(action, condition)] = CANDIDATE_DEFAULTS[action][i]
    POPUP_CODE_BY_CELL[cellKey(action, condition)] = CANDIDATE_POPUPS[action][i]
  })
}
for (const action of CUSTOMER_ACTIONS) {
  CUSTOMER_CONDITIONS.forEach((condition, i) => {
    DEFAULT_EFFECTS[cellKey(action, condition)] = CUSTOMER_DEFAULTS[action][i]
    POPUP_CODE_BY_CELL[cellKey(action, condition)] = CUSTOMER_POPUPS[action][i]
  })
}
// The cross-cutting AVG gate row: whatsapp.send × no-consent always defaults to block/P8.
DEFAULT_EFFECTS[cellKey(WHATSAPP_SEND_ACTION, NO_CONSENT_CONDITION)] = 'block'
POPUP_CODE_BY_CELL[cellKey(WHATSAPP_SEND_ACTION, NO_CONSENT_CONDITION)] = 'P8'

// The seed-default effect for one cell (fallback 'allow', mirroring ActionRuleCatalog::defaultEffect()).
export const defaultEffectFor = (action: string, condition: string): Effect =>
  DEFAULT_EFFECTS[cellKey(action, condition)] ?? 'allow'

// The fixed popup code for one cell, or null when the default is a silent allow.
export const popupCodeFor = (action: string, condition: string): string | null =>
  POPUP_CODE_BY_CELL[cellKey(action, condition)] ?? null

/**
 * Locked cells — system-wide hard rules the tenant matrix must never be able to loosen,
 * rendered read-only with a lock icon (Danny 2026-07-16 task spec). Per AXIS-MATRIX.md:
 * archived (P4, every candidate action) and the WhatsApp no-consent gate (P8) are safety/
 * AVG invariants, unlike blacklist (P3) or customer-blocked (P10) which stay tenant-editable
 * (e.g. task.create already softens blacklist to a warn in the seed itself).
 *
 * NOTE (measured gap, see report): the backend does not itself refuse a PUT override for
 * these cells — this lock is a frontend-only safeguard. Recommend the backend also reject
 * (or ignore) overrides for archived/no-consent cells so a direct API call can't bypass it.
 */
export const isLockedCell = (action: string, condition: string): boolean =>
  condition === 'archived' || (action === WHATSAPP_SEND_ACTION && condition === NO_CONSENT_CONDITION)
