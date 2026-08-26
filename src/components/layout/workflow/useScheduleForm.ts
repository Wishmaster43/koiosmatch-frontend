/**
 * useScheduleForm — owns every editable value of the trigger/schedule modal
 * (trigger type, event key, agent name and all recurrence fields) plus the two
 * shapes derived from them: the ScheduleConfig handed to `onSave` and the live
 * preview config.
 *
 * WORKFLOW-SCHEMA-1: the `scheduled` recurrence fields mirror the backend
 * contract directly — `frequency`, `times` (H:i list, every frequency except
 * interval), `weekdays` (ISO 1-7, Monday=1, weekly only), `monthday`
 * (monthly/quarterly/yearly), `month` (yearly only), `interval_minutes`
 * (interval only). Loading seeds from `normalizeScheduleConfig` (scheduleLabel.ts)
 * so the three legacy shapes (single `schedule_time`/`time`, a bare `times`
 * array, `schedule: 'weekly'` + `day`) render into the right controls without
 * ever rewriting the stored data until the user actually hits Save.
 *
 * Pulled out of ScheduleModal so that component stays declarative markup (§3
 * "all logic in hooks"), and so the recurrence editor can be handed the whole
 * form as ONE prop instead of sixteen threaded setters. The state deliberately
 * lives here (modal level, not inside the recurrence section) so switching the
 * trigger type back and forth keeps what the user already configured.
 */
import { useState } from 'react'
import type { ScheduleConfig } from '@/types/workflow'
import { WORKFLOW_EVENT_KEYS } from './eventCatalog'
import { DATE_RELATIVE_FIELDS } from './dateRelativeFieldOptions'
import { normalizeScheduleConfig } from './scheduleLabel'

// See the file's top doc above for the full set of values this hook owns and the legacy shapes it normalizes on load.
export function useScheduleForm(
  trigger: string | undefined,
  scheduleConfig: ScheduleConfig | null | undefined,
  onSave: (trigger: string, cfg: ScheduleConfig | null) => void,
) {
  // Trigger type is seeded from the stored trigger name; anything else is a schedule.
  const [type,     setType]     = useState(
    trigger === 'Handmatig' ? 'manual' : trigger === 'Direct' ? 'instant'
      : trigger === 'Event' ? 'event' : trigger === 'Webhook' ? 'webhook'
      : trigger === 'DateRelative' ? 'date_relative' : 'scheduled',
  )
  // Seed the recurrence fields via the ONE normaliser shared with scheduleLabel,
  // so the current contract shape AND the three legacy shapes all land correctly.
  const seed = normalizeScheduleConfig(scheduleConfig)
  const [frequency, setFrequency] = useState(seed.frequency)
  // Event trigger: the selected domain-event key (seeded from the catalogue fallback).
  const [eventKey, setEventKey] = useState(String(scheduleConfig?.event ?? WORKFLOW_EVENT_KEYS[0]))
  // Webhook trigger, AI-agent flavor (AI-AGENTS-3): the agent NAME this workflow's
  // own webhook is coupled to (backend matches trigger_config.agent by name).
  const [agentName, setAgentName] = useState(String(scheduleConfig?.agent ?? ''))
  // Date-relative trigger (date_field + a positive "days before" UI value — the
  // stored offset_days is negated on save, see handleSave).
  const [dateField, setDateField] = useState(String(scheduleConfig?.date_field ?? DATE_RELATIVE_FIELDS[0].value))
  const [offsetDays, setOffsetDays] = useState<number | string>(
    scheduleConfig?.offset_days != null ? Math.abs(Number(scheduleConfig.offset_days)) : 28,
  )
  // Firing moments on a due day — applies to every frequency except interval.
  const [times,    setTimes]    = useState<string[]>(seed.times)
  // ISO weekdays (Monday=1..Sunday=7) — weekly only.
  const [weekdays, setWeekdays] = useState<number[]>(seed.weekdays)
  const [monthday, setMonthday] = useState(seed.monthday)
  const [month,    setMonth]    = useState(seed.month)
  const [intervalMinutes, setIntervalMinutes] = useState<number | string>(seed.intervalMinutes)
  const toggleWeekday = (iso: number) => setWeekdays(ws => ws.includes(iso) ? ws.filter(x => x !== iso) : [...ws, iso].sort((a, b) => a - b))

  const addTime    = () => setTimes(ts => (ts.length >= 12 ? ts : [...ts, '09:00']))
  const removeTime = (i: number)  => setTimes(ts => ts.filter((_, j) => j !== i))
  const updateTime = (i: number, v: string) => setTimes(ts => ts.map((t, j) => j === i ? v : t))

  // Guards a Save that would persist an unusable config. `min={5}` on the interval
  // input does nothing outside a real form submit — this is a controlled string
  // (`intervalMinutes`), so an emptied field becomes '' and `+''` is 0, silently
  // saving an invalid interval. A webhook trigger with no agent chosen would
  // likewise persist an empty `agent` value, and weekly needs at least one
  // selected weekday. Disabling Save is a hard backstop regardless of whether the
  // field was ever blurred (a blur-only clamp would miss "delete then click Save"
  // without tabbing out first).
  const canSave = !(
    (type === 'scheduled' && frequency === 'interval' && (Number.isNaN(+intervalMinutes) || +intervalMinutes < 5 || +intervalMinutes > 10080)) ||
    (type === 'scheduled' && frequency === 'weekly' && weekdays.length === 0) ||
    (type === 'scheduled' && frequency !== 'interval' && times.length === 0) ||
    (type === 'webhook' && !agentName) ||
    (type === 'date_relative' && (!dateField || Number.isNaN(+offsetDays) || +offsetDays < 0))
  )

  // Build the trigger name + config the canvas stores; only the fields the
  // chosen frequency actually uses are written, so no stale keys are persisted —
  // this IS the flat trigger_config the backend contract validates directly.
  const handleSave = () => {
    if (!canSave) return
    if (type === 'manual')  { onSave('Handmatig', null); return }
    if (type === 'instant') { onSave('Direct', null); return }
    // Event trigger: carries the chosen event key, no schedule fields.
    if (type === 'event')   { onSave('Event', { event: eventKey }); return }
    // Webhook trigger (AI-agent flavor): carries only the chosen agent's name —
    // the backend couples this workflow to that agent's own inbound webhook.
    if (type === 'webhook') { onSave('Webhook', { agent: agentName }); return }
    // Date-relative trigger: the UI's positive "days before" becomes a negative
    // offset_days on the wire (contract: -28 = "28 days before" the date field).
    if (type === 'date_relative') {
      onSave('DateRelative', { date_field: dateField, offset_days: -Math.abs(+offsetDays) })
      return
    }
    if (frequency === 'interval') { onSave('Scheduled', { frequency, interval_minutes: +intervalMinutes }); return }
    const cfg: ScheduleConfig = { frequency, times }
    if (frequency === 'weekly')                                cfg.weekdays = weekdays
    if (['monthly', 'quarterly', 'yearly'].includes(frequency)) cfg.monthday = +monthday
    if (frequency === 'yearly')                                 cfg.month = +month
    onSave('Scheduled', cfg)
  }

  // Live preview for EVERY trigger type — the same scheduleLabel the node shows.
  const previewTrigger = type === 'manual' ? 'Handmatig' : type === 'instant' ? 'Direct'
    : type === 'event' ? 'Event' : type === 'webhook' ? 'Webhook'
    : type === 'date_relative' ? 'DateRelative' : 'Scheduled'
  const previewCfg: ScheduleConfig | null = type === 'event' ? { event: eventKey }
    : type === 'webhook' ? { agent: agentName }
    : type === 'date_relative' ? { date_field: dateField, offset_days: -Math.abs(+offsetDays) }
    : type === 'scheduled'
      ? (frequency === 'interval'
        ? { frequency, interval_minutes: +intervalMinutes }
        : { frequency, times, weekdays, monthday: +monthday, month: +month })
      : null

  return {
    type, setType, frequency, setFrequency, eventKey, setEventKey, agentName, setAgentName,
    dateField, setDateField, offsetDays, setOffsetDays,
    times, addTime, removeTime, updateTime,
    weekdays, toggleWeekday, monthday, setMonthday, month, setMonth,
    intervalMinutes, setIntervalMinutes,
    handleSave, canSave, previewTrigger, previewCfg,
  }
}

// The whole form, passed as one prop to the recurrence editor.
export type ScheduleForm = ReturnType<typeof useScheduleForm>
