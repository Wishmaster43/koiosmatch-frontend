/**
 * Workflow API-shape mapping — pure transforms between the backend payload and
 * the editor shape. normalize: API -> UI (steps with id/type/config/position/next);
 * denormalize: UI -> API. Extracted from WorkflowsPage; no React, easy to test.
 */

import type { RawWorkflow, RawStep, Workflow, WorkflowStep } from '../../../types/workflow'

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
    })),
  }))

  // last_run: uit laatste WorkflowRun of direct
  const lastRun = wf.last_run ?? (wf.latest_run
    ? { time: wf.latest_run.created_at, ok: wf.latest_run.status === 'success' }
    : null)

  return { ...wf, trigger, status, steps, last_run: lastRun }
}

// Vertaal frontend trigger string → trigger_type + trigger_config
function parseTrigger(trigger?: string): { trigger_type: string; trigger_config: Record<string, unknown> } {
  if (!trigger || trigger === 'Handmatig') return { trigger_type: 'manual', trigger_config: {} }
  if (trigger.toLowerCase().includes('webhook')) return { trigger_type: 'webhook', trigger_config: {} }
  // "Dagelijks 08:00", "Elk uur", "Maandag 07:00" → scheduled
  const timeMatch = trigger.match(/(\d{2}:\d{2})/)
  return {
    trigger_type: 'scheduled',
    trigger_config: { schedule_label: trigger, schedule_time: timeMatch?.[1] ?? '09:00' },
  }
}

// Vertaal frontend formaat → backend formaat voor opslaan
export function denormalizeWorkflow(wf: Workflow) {
  const { trigger_type, trigger_config } = parseTrigger(wf.trigger)
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
