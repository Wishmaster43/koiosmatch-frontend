/**
 * Workflow API-shape mapping — pure transforms between the backend payload and
 * the editor shape. normalize: API -> UI (steps with id/type/config/position/next);
 * denormalize: UI -> API. Extracted from WorkflowsPage; no React, easy to test.
 *
 * WFB-01..05 (CMBE contract audit, 09-09): the API emits `trigger` as a HUMAN label
 * ('Bij gebeurtenis: …', 'Wekelijks (ma, do) 08:00') next to the structured
 * `trigger_type` + `trigger_config`. The editor speaks its own trigger words
 * (TRIGGER_WORD below), so normalize maps type -> word and denormalize maps word -> type,
 * and `trigger_config` travels VERBATIM both ways (GET-shape == PUT-shape). Re-deriving
 * it from the label, as before, wiped the schedule, the event conditions and the
 * webhook source lane on every status toggle, folder move and editor save.
 */

import type { RawWorkflow, RawStep, Workflow, WorkflowStep } from '@/types/workflow'

// Backend trigger_type -> the editor's trigger word (useScheduleForm / scheduleLabel vocabulary).
const TRIGGER_WORD: Record<string, string> = {
  manual: 'Handmatig', scheduled: 'Scheduled', webhook: 'Webhook', event: 'Event', date_relative: 'DateRelative',
}

// The editor's trigger word -> backend trigger_type. 'Direct' ("zodra data binnenkomt")
// has no backend type: a data-driven start is the webhook/applicant_event START CARD
// (deriveStartTrigger), so the header word persists as manual — never as the phantom
// daily 09:00 schedule the old fall-through produced.
const TRIGGER_TYPE: Record<string, string> = {
  Handmatig: 'manual', Manual: 'manual', Direct: 'manual', Scheduled: 'scheduled',
  Webhook: 'webhook', Event: 'event', DateRelative: 'date_relative',
}

export function normalizeWorkflow(wf: RawWorkflow): Workflow {
  // trigger: the editor word for the structured type; a payload without a type keeps
  // its string (legacy caches), else manual. The API's human label stays available
  // as `trigger_label` for display — it is never parsed again.
  const typeWord = wf.trigger_type ? TRIGGER_WORD[wf.trigger_type] : undefined
  const trigger = typeWord ?? (typeof wf.trigger === 'string' ? wf.trigger : 'Handmatig')
  const trigger_label = typeof wf.trigger === 'string' ? wf.trigger : null

  // status: active boolean -> string
  const status = typeof wf.status === 'string'
    ? wf.status
    : (wf.active ? 'active' : 'inactive')

  // steps: normalize to { id, type, config, label, position, next } — next = outgoing
  // connections (graph), so Router branches + connection filters are preserved. The
  // per-step label (seeded templates name their steps) rides along or a save wipes it.
  const rawSteps = (Array.isArray(wf.steps) ? wf.steps : (wf.workflow_steps ?? [])) as RawStep[]
  const steps: WorkflowStep[] = rawSteps.map(s => ({
    id:       s.id ? String(s.id) : undefined,
    type:     s.module_type ?? s.type,
    config:   s.config ?? s.parameters ?? {},
    ...(s.label != null ? { label: String(s.label) } : {}),
    position: s.position ?? undefined,
    next:     (s.next ?? s.connections ?? []).map(n => ({
      target:  n.target != null ? String(n.target) : (n.target as null | undefined),
      filters: n.filters ?? null,
      // Carry the handle ids + label — dropping them collapsed Router OR-branches
      // to the default port on reload (test-wave find, 16-07; stepsToFlow reads all three).
      ...(n.source_handle != null ? { source_handle: String(n.source_handle) } : {}),
      ...(n.target_handle != null ? { target_handle: String(n.target_handle) } : {}),
      ...(n.label != null ? { label: String(n.label) } : {}),
    })),
  }))

  // last_run: from the latest WorkflowRun, or already present directly
  const lastRun = wf.last_run ?? (wf.latest_run
    ? { time: wf.latest_run.created_at, ok: wf.latest_run.status === 'success' }
    : null)

  // TRASH-OVERAL-2: archived flag + trash lifecycle, tolerant of older payloads
  // (deleted_at implies archived; a missing lifecycle derives from that flag).
  const archived = Boolean(wf.archived ?? wf.deleted_at)
  const lifecycle = (wf.lifecycle as Workflow['lifecycle']) ?? (archived ? 'archived' : 'active')

  return { ...wf, trigger, trigger_label, status, steps, last_run: lastRun, archived, lifecycle,
    pending_erase_at: (wf.pending_erase_at as string | null | undefined) ?? null }
}

// The trigger word (or a legacy/human label) + the structured type -> backend trigger_type.
function resolveTriggerType(trigger: string | undefined, triggerType: string | undefined): string {
  if (trigger && TRIGGER_TYPE[trigger]) return TRIGGER_TYPE[trigger]
  // Not an editor word: the structured type wins (a server label must never be re-parsed).
  if (triggerType && TRIGGER_WORD[triggerType]) return triggerType
  if (!trigger) return 'manual'
  // Legacy strings with no structured type (pre-contract caches): "via webhook",
  // "Dagelijks 08:00", "Elk uur".
  return trigger.toLowerCase().includes('webhook') ? 'webhook' : 'scheduled'
}

// trigger word + config + structured type -> { trigger_type, trigger_config }. The
// config is passed through untouched for every non-manual type; only a legacy schedule
// label with no config at all still contributes its embedded time.
function parseTrigger(
  trigger: string | undefined, config: Record<string, unknown> | null | undefined, triggerType: string | undefined,
): { trigger_type: string; trigger_config: Record<string, unknown> } {
  const trigger_type = resolveTriggerType(trigger, triggerType)
  if (trigger_type === 'manual') return { trigger_type, trigger_config: {} }
  if (config && typeof config === 'object') return { trigger_type, trigger_config: { ...config } }
  const time = trigger_type === 'scheduled' ? trigger?.match(/(\d{2}:\d{2})/)?.[1] : undefined
  return { trigger_type, trigger_config: time ? { schedule_time: time } : {} }
}

// Translate the frontend shape -> backend shape for saving
export function denormalizeWorkflow(wf: Workflow) {
  const { trigger_type, trigger_config } = parseTrigger(wf.trigger, wf.trigger_config, wf.trigger_type)
  return {
    name:           wf.name,
    trigger_type,
    trigger_config: wf.schedule ? { ...trigger_config, schedule: wf.schedule } : trigger_config,
    active:         wf.status === 'active',
    status:         wf.status ?? 'draft',
    steps:          (wf.steps ?? []).map((s, i) => ({
      id:          s.id ?? null,
      module_type: s.type,
      config:      s.config ?? {},
      label:       s.label ?? null,
      order:       i,
      position:    s.position ?? null,
      // Outgoing connections (graph): target = step id, edge filter, label, and the
      // ORIGINAL handle ids. Dropping label/handles here (as before) collapsed every
      // Router branch to the default 'out' port and lost its name on save — the API
      // stores these verbatim (WorkflowWriter.php:102) and emits them back unchanged
      // (app/Http/Resources/Workflow/WorkflowResource.php:56-64), so the round-trip must be lossless on our side too.
      connections: (s.next ?? []).map(n => ({
        target:        n.target,
        filters:       n.filters ?? null,
        label:         n.label ?? null,
        source_handle: n.source_handle ?? 'out',
        target_handle: n.target_handle ?? 'in',
      })),
    })),
  }
}
