/**
 * useScheduleForm — owns every editable value of the trigger/schedule modal
 * (trigger type, event key, agent name and all recurrence fields) plus the two
 * shapes derived from them: the ScheduleConfig handed to `onSave` and the live
 * preview config.
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

export function useScheduleForm(
  trigger: string | undefined,
  scheduleConfig: ScheduleConfig | null | undefined,
  onSave: (trigger: string, cfg: ScheduleConfig | null) => void,
) {
  // Trigger type is seeded from the stored trigger name; anything else is a schedule.
  const [type,     setType]     = useState(
    trigger === 'Handmatig' ? 'manual' : trigger === 'Direct' ? 'instant'
      : trigger === 'Event' ? 'event' : trigger === 'Webhook' ? 'webhook' : 'scheduled',
  )
  const [sType,    setSType]    = useState(scheduleConfig?.schedule_type ?? 'daily')
  // Event trigger: the selected domain-event key (seeded from the catalogue fallback).
  const [eventKey, setEventKey] = useState(String(scheduleConfig?.event ?? WORKFLOW_EVENT_KEYS[0]))
  // Webhook trigger, AI-agent flavor (AI-AGENTS-3): the agent NAME this workflow's
  // own webhook is coupled to (backend matches trigger_config.agent by name).
  const [agentName, setAgentName] = useState(String(scheduleConfig?.agent ?? ''))
  const [intVal,   setIntVal]   = useState<number | string>(scheduleConfig?.interval_value ?? 15)
  const [intUnit,  setIntUnit]  = useState(scheduleConfig?.interval_unit  ?? 'minutes')
  const [time,     setTime]     = useState(scheduleConfig?.time ?? '08:00')
  const [times,    setTimes]    = useState<string[]>(scheduleConfig?.times ?? ['08:00'])
  const [dow,      setDow]      = useState<number[]>(scheduleConfig?.days_of_week ?? [1, 2, 3, 4, 5])
  const [dom,      setDom]      = useState(scheduleConfig?.day_of_month ?? 1)
  const [month,    setMonth]    = useState(scheduleConfig?.month ?? 1)
  const toggleDay = (d: number) => setDow(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort((a,b)=>a-b))

  const addTime    = () => setTimes(ts => [...ts, '08:00'])
  const removeTime = (i: number)  => setTimes(ts => ts.filter((_, j) => j !== i))
  const updateTime = (i: number, v: string) => setTimes(ts => ts.map((t, j) => j === i ? v : t))

  // Guards a Save that would persist an unusable config. `min={1}` on the interval
  // input does nothing outside a real form submit — this is a controlled string
  // (`intVal`), so an emptied field becomes '' and `+''` is 0, silently saving an
  // interval of zero. A webhook trigger with no agent chosen would likewise
  // persist an empty `agent` value. Disabling Save is a hard backstop regardless
  // of whether the field was ever blurred (a blur-only clamp would miss "delete
  // then click Save" without tabbing out first).
  const canSave = !(
    (type === 'scheduled' && sType === 'interval' && (Number.isNaN(+intVal) || +intVal < 1)) ||
    (type === 'webhook' && !agentName)
  )

  // Build the trigger name + config the canvas stores; only the fields the
  // chosen frequency actually uses are written, so no stale keys are persisted.
  const handleSave = () => {
    if (!canSave) return
    if (type === 'manual')  { onSave('Handmatig', null); return }
    if (type === 'instant') { onSave('Direct', null); return }
    // Event trigger: carries the chosen event key, no schedule fields.
    if (type === 'event')   { onSave('Event', { schedule_type: 'event', event: eventKey }); return }
    // Webhook trigger (AI-agent flavor): carries only the chosen agent's name —
    // the backend couples this workflow to that agent's own inbound webhook.
    if (type === 'webhook') { onSave('Webhook', { schedule_type: 'webhook', agent: agentName }); return }
    const cfg: ScheduleConfig = { schedule_type: sType }
    if (sType === 'interval') { cfg.interval_value = +intVal; cfg.interval_unit = intUnit }
    else if (sType === 'daily')     { cfg.times = times }
    else if (sType === 'weekly')    { cfg.days_of_week = dow; cfg.time = time }
    else if (sType === 'monthly')   { cfg.day_of_month = +dom; cfg.time = time }
    else if (sType === 'quarterly') { cfg.time = time }
    else if (sType === 'yearly')    { cfg.day_of_month = +dom; cfg.month = +month; cfg.time = time }
    onSave('Scheduled', cfg)
  }

  // Live preview for EVERY trigger type — the same scheduleLabel the node shows.
  const previewTrigger = type === 'manual' ? 'Handmatig' : type === 'instant' ? 'Direct'
    : type === 'event' ? 'Event' : type === 'webhook' ? 'Webhook' : 'Scheduled'
  const previewCfg: ScheduleConfig | null = type === 'event' ? { schedule_type: 'event', event: eventKey }
    : type === 'webhook' ? { schedule_type: 'webhook', agent: agentName }
    : type === 'scheduled' ? { schedule_type: sType, interval_value: +intVal, interval_unit: intUnit, time, times, days_of_week: dow, day_of_month: dom, month }
    : null

  return {
    type, setType, sType, setSType, eventKey, setEventKey, agentName, setAgentName,
    intVal, setIntVal, intUnit, setIntUnit, time, setTime,
    times, addTime, removeTime, updateTime,
    dow, toggleDay, dom, setDom, month, setMonth,
    handleSave, canSave, previewTrigger, previewCfg,
  }
}

// The whole form, passed as one prop to the recurrence editor.
export type ScheduleForm = ReturnType<typeof useScheduleForm>
