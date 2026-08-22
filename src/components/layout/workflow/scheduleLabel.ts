/**
 * scheduleLabel — the human-readable one-line summary of a workflow trigger
 * (manual / instant / event / webhook / date-relative / every scheduled
 * recurrence), plus the Intl date-name helpers it shares with the recurrence
 * editor.
 *
 * WORKFLOW-SCHEMA-1: the `scheduled` trigger's config now matches the backend
 * contract directly on `trigger_config` (no `schedule_type` wrapper) — a
 * `frequency` key (daily | weekly | monthly | quarterly | yearly | interval),
 * `times` (H:i list, every frequency except interval), `weekdays` (ISO 1-7,
 * Monday=1, weekly only), `monthday` (monthly/quarterly/yearly), `month`
 * (yearly only) and `interval_minutes` (interval only). Three legacy shapes
 * must keep reading correctly (never migrated on the wire, only normalised in
 * memory): a single `schedule_time`/`time` (daily), a bare `times` array with
 * no `frequency` (daily), and `schedule: 'weekly'` + `day` as an ISO number or
 * an English weekday name.
 *
 * Pulled out of ScheduleModal because it is a PURE `(t, locale, trigger, cfg)`
 * formatter with no React in it: the trigger node, the trigger button and the
 * modal's live preview all render the exact same string from it, so it must not
 * be locked inside the modal component's module.
 */
import type { TFunction } from 'i18next'
import type { ScheduleConfig } from '@/types/workflow'
import { WORKFLOW_EVENT_KEYS, eventKeyToI18nKey } from './eventCatalog'
import { dateRelativeFieldLabel } from './dateRelativeFieldOptions'

// Localized short day/month names from Intl. `dayIndex` is Sunday=0 (Intl/Date
// convention); `dayNameIso` below is the ISO-weekday (Monday=1..Sunday=7) wrapper
// the schedule fields actually use, so callers never hand-roll the 7→0 remap.
export const dayName   = (locale: string, dayIndex: number) => new Date(Date.UTC(2024, 0, 7 + dayIndex)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
export const monthName = (locale: string, m: number) => new Date(Date.UTC(2024, m, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })
// ISO weekday (Monday=1 .. Sunday=7) → localized short name.
export const dayNameIso = (locale: string, iso: number) => dayName(locale, iso === 7 ? 0 : iso)

// Named-weekday legacy fallback (English, case-insensitive) → ISO number.
const WEEKDAY_NAME_TO_ISO: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
}

// Normalises a legacy `day` value (ISO number or an English weekday name) to ISO 1-7.
function normalizeWeekday(day: unknown): number {
  if (typeof day === 'number') return day
  const n = Number(day)
  if (!Number.isNaN(n)) return n
  return WEEKDAY_NAME_TO_ISO[String(day).toLowerCase()] ?? 1
}

// Normalises ANY stored scheduled-trigger config (current contract or one of
// the three legacy shapes) into the contract's own field names. Shared by the
// label formatter and useScheduleForm so both read the same precedence order.
export function normalizeScheduleConfig(cfg: ScheduleConfig | null | undefined): {
  frequency: string; times: string[]; weekdays: number[]; monthday: number; month: number; intervalMinutes: number
} {
  const c = (cfg ?? {}) as Record<string, unknown>
  // Current contract: `frequency` present.
  if (typeof c.frequency === 'string') {
    return {
      frequency: c.frequency,
      times: Array.isArray(c.times) && c.times.length ? c.times as string[] : ['09:00'],
      weekdays: Array.isArray(c.weekdays) && c.weekdays.length ? c.weekdays as number[] : [1],
      monthday: Number(c.monthday) || 1,
      month: Number(c.month) || 1,
      intervalMinutes: Number(c.interval_minutes) || 30,
    }
  }
  // Legacy: `schedule: 'weekly'` + `day` (ISO number or English name).
  if (c.schedule === 'weekly') {
    return {
      frequency: 'weekly',
      times: c.time ? [String(c.time)] : ['09:00'],
      weekdays: [normalizeWeekday(c.day)],
      monthday: 1, month: 1, intervalMinutes: 30,
    }
  }
  // Legacy: a single `schedule_time`/`time` (daily), or a bare `times` array
  // with no frequency (also daily).
  const legacyTime = (c.schedule_time ?? c.time) as string | undefined
  const legacyTimes = Array.isArray(c.times) ? c.times as string[] : undefined
  if (legacyTime || legacyTimes) {
    return {
      frequency: 'daily',
      times: legacyTimes && legacyTimes.length ? legacyTimes : [legacyTime as string],
      weekdays: [1], monthday: 1, month: 1, intervalMinutes: 30,
    }
  }
  // Nothing usable at all — sane daily default.
  return { frequency: 'daily', times: ['09:00'], weekdays: [1], monthday: 1, month: 1, intervalMinutes: 30 }
}

// Human-readable summary of the trigger/schedule; needs `t` (used on the node too).
export function scheduleLabel(t: TFunction, locale: string, trigger?: string, cfg?: ScheduleConfig | null) {
  if (!trigger || trigger === 'Handmatig') return t('scheduleModal.label.manual')
  if (trigger === 'Direct') return t('scheduleModal.label.instant')
  // Event trigger: show the tenant-facing event name, not the raw dotted key.
  if (trigger === 'Event') {
    const eventKey = String(cfg?.event ?? WORKFLOW_EVENT_KEYS[0])
    return t('scheduleModal.label.event', { event: t(`triggers.events.${eventKeyToI18nKey(eventKey)}`) })
  }
  // Webhook trigger (AI-AGENTS-3): the new agent-coupled flavor names its agent;
  // the legacy generic-webhook flavor (webhook_id, no agent picker here yet)
  // falls back to a plain "Webhook" label instead of misreading as "Gepland".
  if (trigger === 'Webhook') {
    return cfg?.agent ? t('scheduleModal.label.webhookAgent', { agent: cfg.agent }) : t('scheduleModal.label.webhook')
  }
  // Date-relative trigger: "N days before <field>" — offset_days is stored
  // negative, so the preview always shows its absolute value (§ positive UI rule).
  if (trigger === 'DateRelative') {
    const days = Math.abs(Number(cfg?.offset_days ?? 0))
    return t('scheduleModal.label.dateRelative', { count: days, field: dateRelativeFieldLabel(t, cfg?.date_field as string | undefined) })
  }
  if (trigger !== 'Scheduled') return t('scheduleModal.label.scheduled')
  if (!cfg) return t('scheduleModal.label.scheduled')
  const { frequency, times, weekdays, monthday, month, intervalMinutes } = normalizeScheduleConfig(cfg)
  if (frequency === 'interval') return t('scheduleModal.label.everyN', { n: intervalMinutes })
  const time = times.join(', ')
  if (frequency === 'weekly') {
    const days = [...weekdays].sort((a, b) => a - b).map(iso => dayNameIso(locale, iso)).join(', ')
    return t('scheduleModal.label.weeklyAt', { days, time })
  }
  if (frequency === 'monthly')   return t('scheduleModal.label.monthlyAt', { day: monthday, time })
  if (frequency === 'quarterly') return t('scheduleModal.label.quarterlyAt', { day: monthday, time })
  if (frequency === 'yearly')    return t('scheduleModal.label.yearlyAt', { month, day: monthday, time })
  return t('scheduleModal.label.dailyAt', { time })
}

// Extra, non-example-line note shown when a monthday can't exist in every
// month — kept OUT of scheduleLabel so the example line always matches the
// contract's reference wording exactly.
export function scheduleShortMonthNote(t: TFunction, cfg?: ScheduleConfig | null): string | null {
  if (!cfg) return null
  const { frequency, monthday } = normalizeScheduleConfig(cfg)
  if (!['monthly', 'quarterly', 'yearly'].includes(frequency)) return null
  return monthday > 28 ? t('scheduleModal.shortMonthNote', { day: monthday }) : null
}
