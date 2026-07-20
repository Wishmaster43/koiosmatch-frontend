/**
 * Workflow API-shape mapping — pure transforms between the backend payload and
 * the editor shape. normalize: API -> UI (steps with id/type/config/position/next);
 * denormalize: UI -> API. Extracted from WorkflowsPage; no React, easy to test.
 */

import type { RawWorkflow, RawStep, Workflow, WorkflowStep } from '@/types/workflow'

export function normalizeWorkflow(wf: RawWorkflow): Workflow {
  // trigger: string samengesteld uit trigger_type + trigger_config, of al een string
  const trigger = typeof wf.trigger === 'string'
    ? wf.trigger
    : wf.trigger_type ?? 'Handmatig'

  // status: active boolean → string
  const status = typeof wf.status === 'string'
    ? wf.status
    : (wf.active ? 'active' : 'inactive')

  // steps: normaliseren naar { id, type, config, position, next } — next = uitgaande
  // verbindingen (graaf), zodat Router-takken + verbindingsfilters bewaard blijven.
  const rawSteps = (Array.isArray(wf.steps) ? wf.steps : (wf.workflow_steps ?? [])) as RawStep[]
  const steps: WorkflowStep[] = rawSteps.map(s => ({
    id:       s.id ? String(s.id) : undefined,
    type:     s.module_type ?? s.type,
    config:   s.config ?? s.parameters ?? {},
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

  // last_run: uit laatste WorkflowRun of direct
  const lastRun = wf.last_run ?? (wf.latest_run
    ? { time: wf.latest_run.created_at, ok: wf.latest_run.status === 'success' }
    : null)

  return { ...wf, trigger, status, steps, last_run: lastRun }
}

// Vertaal frontend trigger string → trigger_type + trigger_config
function parseTrigger(trigger?: string, config?: Record<string, unknown>): { trigger_type: string; trigger_config: Record<string, unknown> } {
  if (!trigger || trigger === 'Handmatig') return { trigger_type: 'manual', trigger_config: {} }
  // Webhook trigger: two flavors share trigger_type 'webhook' — an AI-agent's own
  // inbound webhook (AI-AGENTS-3, config.agent) or the legacy generic inbound
  // webhook resource (config.webhook_id). Keep whichever the editor set — dropping
  // both to {} unconditionally here was the exact fall-through bug that already
  // hit the Event branch once (see below); never repeat it for webhook either.
  if (trigger.toLowerCase().includes('webhook')) {
    return {
      trigger_type: 'webhook',
      trigger_config: config?.agent ? { agent: config.agent } : config?.webhook_id ? { webhook_id: config.webhook_id } : {},
    }
  }
  // Event trigger (BIRTHDAY-FLOW-2): keep the editor's { event } config verbatim —
  // falling through to the scheduled-regex would silently ship trigger_type 'scheduled'.
  if (trigger.toLowerCase() === 'event') return { trigger_type: 'event', trigger_config: { event: config?.event ?? null } }
  // "Dagelijks 08:00", "Elk uur", "Maandag 07:00" → scheduled
  const timeMatch = trigger.match(/(\d{2}:\d{2})/)
  return {
    trigger_type: 'scheduled',
    trigger_config: { schedule_label: trigger, schedule_time: timeMatch?.[1] ?? '09:00' },
  }
}

// Vertaal frontend formaat → backend formaat voor opslaan
export function denormalizeWorkflow(wf: Workflow) {
  const { trigger_type, trigger_config } = parseTrigger(wf.trigger, (wf as { trigger_config?: Record<string, unknown> }).trigger_config)
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
      // Outgoing connections (graph): target = step id, optional edge filter.
      connections: (s.next ?? []).map(n => ({ target: n.target, filters: n.filters ?? null })),
    })),
  }
}
