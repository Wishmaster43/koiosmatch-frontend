/**
 * scheduleLabel — the human-readable one-line summary of a workflow trigger
 * (manual / instant / event / webhook / every recurrence flavour), plus the two
 * Intl date-name helpers it shares with the recurrence editor.
 *
 * Pulled out of ScheduleModal because it is a PURE `(t, locale, trigger, cfg)`
 * formatter with no React in it: the trigger node, the trigger button and the
 * modal's live preview all render the exact same string from it, so it must not
 * be locked inside the modal component's module.
 *
 * Day/month names come from Intl (locale-aware) so there are no hardcoded NL arrays.
 */
import type { TFunction } from 'i18next'
import type { ScheduleConfig } from '@/types/workflow'
import { WORKFLOW_EVENT_KEYS, eventKeyToI18nKey } from './eventCatalog'

// Localized short day/month names from Intl (week starts Sunday = index 0).
export const dayName   = (locale: string, i: number) => new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
export const monthName = (locale: string, m: number) => new Date(Date.UTC(2024, m, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })

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
  if (!cfg) return t('scheduleModal.label.scheduled')
  const ty = cfg.schedule_type
  if (ty === 'interval') {
    const unit = cfg.interval_unit === 'hours' ? t('scheduleModal.label.unitHour') : t('scheduleModal.label.unitMin')
    return t('scheduleModal.label.everyN', { n: cfg.interval_value ?? 1, unit })
  }
  const time = cfg.time ?? '08:00'
  if (ty === 'daily')     return t('scheduleModal.label.dailyAt', { time })
  if (ty === 'weekly') {
    const days = (cfg.days_of_week ?? [1]).map(i => dayName(locale, i)).join(', ')
    return t('scheduleModal.label.weeklyAt', { days, time })
  }
  if (ty === 'monthly')   return t('scheduleModal.label.monthlyAt', { day: cfg.day_of_month ?? 1, time })
  if (ty === 'quarterly') return t('scheduleModal.label.quarterlyAt', { time })
  if (ty === 'yearly')    return t('scheduleModal.label.yearlyAt', { month: monthName(locale, (cfg.month ?? 1) - 1), day: cfg.day_of_month ?? 1, time })
  return t('scheduleModal.label.scheduled')
}
