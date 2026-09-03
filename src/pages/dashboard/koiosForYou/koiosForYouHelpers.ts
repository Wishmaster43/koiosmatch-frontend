/**
 * KoiosForYouCard pure helpers — date/range computation and action categorization.
 * All functions are deterministic (no side effects); they depend only on their
 * inputs and can be tested without mocking React/i18n.
 */

// Preset period keys driving the from/to computation — 'thisWeek' is the
// default (Monday through today), 'custom' opens the two date inputs.
export type PeriodPreset = 'thisWeek' | 'lastWeek' | 'last30' | 'custom'

// Bucket every action type into one of eight display categories (KOIOS-KAART-COMPACT-1/2).
export const CATEGORY_ORDER = ['tasks', 'whatsapp', 'appointments', 'emails', 'rejections', 'applications', 'birthdays', 'other'] as const
export type Category = (typeof CATEGORY_ORDER)[number]

// Raw action-type keys (koios_ prefix stripped) that have a translated label —
// anything outside this set gets the humanized fallback, never a raw i18n key.
export const KNOWN_ACTION_TYPES = ['create_task', 'send_whatsapp', 'plan_appointment', 'send_email', 'send_notification', 'add_to_calllist']

// K-174 `created.entity_type` → app-shell page key (mirrors NotificationBell's
// ENTITY_PAGE, K-157 vocabulary). 'appointment' and 'whatsapp' have NO dedicated
// page yet, so they stay unmapped on purpose: the row renders as plain text rather
// than a link to nowhere.
export const CREATED_ENTITY_PAGE: Record<string, string> = {
  task: 'tasks',
  calllist: 'outreach',
  application: 'applications',
  candidate: 'candidates',
}

// Turn a workflow template_key ("koios_create_task") into a readable label —
// these are backend workflow identifiers, not app copy, so a display transform
// (not a translation) is the right treatment, mirroring how slugs read elsewhere.
export function humanizeKey(key: string | null | undefined): string {
  if (!key) return '—'
  return key.replace(/^koios_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Bucket every action type into one of eight display categories. Measured real
// template_key values (BE Workflow model / seeded native templates). Rejection/
// application/birthday automations don't have template keys yet but keep their
// own bucket so a future one lands correctly without a code change; anything
// matching no keyword falls into 'other' — an unknown type is NEVER dropped.
export function categoryOf(rawKey: string | null | undefined): Category {
  const k = (rawKey || '').replace(/^koios_/, '')
  if (/task/.test(k)) return 'tasks'
  if (/whatsapp/.test(k)) return 'whatsapp'
  if (/appointment/.test(k)) return 'appointments'
  if (/email/.test(k)) return 'emails'
  if (/reject/.test(k)) return 'rejections'
  if (/application|apply/.test(k)) return 'applications'
  if (/birthday/.test(k)) return 'birthdays'
  return 'other'
}

// Local calendar-day 'YYYY-MM-DD' — never toISOString().slice(0,10), which
// has a UTC-rollback bug (lib/datetime docblock).
export function toIsoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Monday of the week containing `d` (ISO week start).
export function mondayOf(d: Date): Date {
  const copy = new Date(d)
  const dow = copy.getDay() // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow
  copy.setDate(copy.getDate() + diff)
  return copy
}

// Resolve a preset into a concrete { from, to } pair, given "now" (injectable
// for tests). 'custom' resolves from the caller-supplied inputs.
export function resolveRange(preset: PeriodPreset, now: Date, customFrom: string, customTo: string): { from: string; to: string } {
  if (preset === 'custom') return { from: customFrom, to: customTo }
  if (preset === 'last30') {
    const to = new Date(now)
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return { from: toIsoDay(from), to: toIsoDay(to) }
  }
  const thisMonday = mondayOf(now)
  if (preset === 'lastWeek') {
    const from = new Date(thisMonday)
    from.setDate(from.getDate() - 7)
    const to = new Date(thisMonday)
    to.setDate(to.getDate() - 1)
    return { from: toIsoDay(from), to: toIsoDay(to) }
  }
  // 'thisWeek' — default: Monday through today.
  return { from: toIsoDay(thisMonday), to: toIsoDay(now) }
}
