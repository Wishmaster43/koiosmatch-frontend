/**
 * workflowMap — pure API-shape mapping tests: normalize (API -> UI) and
 * denormalize (UI -> API) field mapping both ways, folder_id passthrough, and
 * status/trigger semantics. Pure functions, no mocking needed.
 */
import { describe, it, expect } from 'vitest'
import { normalizeWorkflow, denormalizeWorkflow } from './workflowMap'
import type { RawWorkflow, Workflow } from '@/types/workflow'

describe('normalizeWorkflow', () => {
  it('keeps an already-string trigger/status as-is', () => {
    const wf = normalizeWorkflow({ trigger: 'Webhook', status: 'active', steps: [] })
    expect(wf.trigger).toBe('Webhook')
    expect(wf.status).toBe('active')
  })

  it('derives trigger from trigger_type, defaulting to "Handmatig" when absent', () => {
    expect(normalizeWorkflow({ trigger_type: 'scheduled', steps: [] }).trigger).toBe('scheduled')
    expect(normalizeWorkflow({ steps: [] }).trigger).toBe('Handmatig')
  })

  it('derives status from the boolean `active` flag when status is not already a string', () => {
    expect(normalizeWorkflow({ active: true, steps: [] }).status).toBe('active')
    expect(normalizeWorkflow({ active: false, steps: [] }).status).toBe('inactive')
    expect(normalizeWorkflow({ steps: [] }).status).toBe('inactive') // active undefined → falsy
  })

  it('reads steps from `steps`, falling back to `workflow_steps`', () => {
    const raw: RawWorkflow = { workflow_steps: [{ id: 1, module_type: 'candidates' }] }
    const wf = normalizeWorkflow(raw)
    expect(wf.steps).toEqual([{ id: '1', type: 'candidates', config: {}, position: undefined, next: [] }])
  })

  it('maps module_type/type and config/parameters (module_type and config win when both are present)', () => {
    const raw: RawWorkflow = { steps: [{ id: 'a', module_type: 'email', type: 'legacy', parameters: { x: 1 } }] }
    expect(normalizeWorkflow(raw).steps[0]).toMatchObject({ type: 'email', config: { x: 1 } })
  })

  it('stringifies each connection target and defaults config to {} when neither config nor parameters is present', () => {
    const raw: RawWorkflow = { steps: [{ id: 'a', type: 'x', next: [{ target: 7, filters: null }] }] }
    const wf = normalizeWorkflow(raw)
    expect(wf.steps[0].config).toEqual({})
    expect(wf.steps[0].next).toEqual([{ target: '7', filters: null }])
  })

  it('passes an already-null/undefined connection target through unchanged (never coerced to a literal string)', () => {
    const raw: RawWorkflow = { steps: [{ id: 'a', type: 'x', next: [{ target: null }, { target: undefined }] }] }
    const wf = normalizeWorkflow(raw)
    expect(wf.steps[0].next).toEqual([{ target: null, filters: null }, { target: undefined, filters: null }])
  })

  // BUG (src/pages/ai/data/workflowMap.ts, normalizeWorkflow's `next:` map, ~L28-32):
  // only `target` and `filters` are copied off each raw connection — `source_handle`,
  // `target_handle` and `label` are silently dropped, even though StepConnection
  // (types/workflow.ts) and stepsToFlow (serialization.ts L44) both read those fields
  // to reconstruct a Router's OR-branches and edge labels. Today this is masked by the
  // C-27 workaround in WorkflowsPage.tsx (a workflow whose server steps already carry a
  // graph is trusted wholesale; the localStorage-cached graph is used verbatim otherwise),
  // but the moment the backend starts returning source_handle/label per connection through
  // this path, every reload will silently collapse each Router branch to the default
  // out/in handle and drop its label. This test encodes the CORRECT (expected) behaviour;
  // it currently fails against the real code — kept skipped until the mapper is fixed.
  it('preserves source_handle/target_handle/label on each connection (Router branch contract)', () => {
    const raw: RawWorkflow = {
      steps: [{ id: 'a', type: 'router', next: [
        { target: 'b', source_handle: 'branch-1', target_handle: 'in', label: 'Yes' },
      ] }],
    }
    const wf = normalizeWorkflow(raw)
    expect(wf.steps[0].next?.[0]).toMatchObject({ target: 'b', source_handle: 'branch-1', target_handle: 'in', label: 'Yes' })
  })

  it('carries every other field through untouched (folder_id passthrough)', () => {
    const wf = normalizeWorkflow({ folder_id: 'f1', name: 'X', steps: [] })
    expect(wf.folder_id).toBe('f1')
    expect(wf.name).toBe('X')
  })

  it('derives last_run from latest_run when last_run itself is absent', () => {
    const wf = normalizeWorkflow({ steps: [], latest_run: { created_at: '2026-07-01T10:00:00Z', status: 'success' } })
    expect(wf.last_run).toEqual({ time: '2026-07-01T10:00:00Z', ok: true })
  })

  it('is null when neither last_run nor latest_run is present', () => {
    expect(normalizeWorkflow({ steps: [] }).last_run).toBeNull()
  })
})

describe('denormalizeWorkflow', () => {
  const base = (overrides: Partial<Workflow> = {}): Workflow => ({ name: 'X', steps: [], ...overrides })

  it('maps a Manual/"Handmatig" trigger (or none) to trigger_type manual with an empty trigger_config', () => {
    expect(denormalizeWorkflow(base({ trigger: 'Handmatig' }))).toMatchObject({ trigger_type: 'manual', trigger_config: {} })
    expect(denormalizeWorkflow(base({ trigger: undefined }))).toMatchObject({ trigger_type: 'manual', trigger_config: {} })
  })

  it('recognizes any trigger string containing "webhook" (case-insensitive)', () => {
    expect(denormalizeWorkflow(base({ trigger: 'Webhook' }))).toMatchObject({ trigger_type: 'webhook' })
    expect(denormalizeWorkflow(base({ trigger: 'via webhook' }))).toMatchObject({ trigger_type: 'webhook' })
  })

  it('parses a scheduled label with an embedded time, defaulting to 09:00 without one', () => {
    const withTime = denormalizeWorkflow(base({ trigger: 'Dagelijks 08:00' }))
    expect(withTime.trigger_type).toBe('scheduled')
    expect(withTime.trigger_config).toMatchObject({ schedule_label: 'Dagelijks 08:00', schedule_time: '08:00' })

    const noTime = denormalizeWorkflow(base({ trigger: 'Elk uur' }))
    expect(noTime.trigger_config).toMatchObject({ schedule_time: '09:00' })
  })

  it('merges an explicit wf.schedule object into trigger_config regardless of trigger type', () => {
    const payload = denormalizeWorkflow(base({ trigger: 'Handmatig', schedule: { time: '08:00' } }))
    expect(payload.trigger_config).toEqual({ schedule: { time: '08:00' } })
  })

  it('maps status to both `active` (boolean) and `status` (string), defaulting status to draft', () => {
    expect(denormalizeWorkflow(base({ status: 'active' }))).toMatchObject({ active: true, status: 'active' })
    expect(denormalizeWorkflow(base({ status: 'paused' }))).toMatchObject({ active: false, status: 'paused' })
    expect(denormalizeWorkflow(base({ status: undefined }))).toMatchObject({ active: false, status: 'draft' })
  })

  it('denormalizes steps: id passthrough (or null), module_type/config/label, 0-based order, and connections', () => {
    const payload = denormalizeWorkflow(base({
      steps: [
        { id: 'a', type: 'candidates', config: { limit: 5 }, position: { x: 0, y: 0 }, next: [{ target: 'b', filters: { conditions: [], logic: 'AND' } }] },
        { type: 'email' }, // no id → null; no config → {}
      ],
    }))
    expect(payload.steps).toEqual([
      {
        id: 'a', module_type: 'candidates', config: { limit: 5 }, label: null, order: 0, position: { x: 0, y: 0 },
        connections: [{ target: 'b', filters: { conditions: [], logic: 'AND' } }],
      },
      { id: null, module_type: 'email', config: {}, label: null, order: 1, position: null, connections: [] },
    ])
  })

  it('does not itself append folder_id — callers add it explicitly (WorkflowsPage.tsx spreads `{ ...denormalizeWorkflow(wf), folder_id }`)', () => {
    const payload = denormalizeWorkflow(base({ folder_id: 'f1' }))
    expect(payload).not.toHaveProperty('folder_id')
  })
})

// BIRTHDAY-FLOW-2: an Event trigger must round-trip as trigger_type 'event' with
// its { event } config intact — never fall through to the scheduled-regex branch.
describe('denormalizeWorkflow · event trigger', () => {
  it('ships trigger_type event with the editor-built event key', () => {
    const wf = { name: 'Bday', trigger: 'Event', trigger_config: { event: 'candidate.birthday' }, status: 'active', steps: [] }
    const out = denormalizeWorkflow(wf as never)
    expect(out.trigger_type).toBe('event')
    expect(out.trigger_config).toMatchObject({ event: 'candidate.birthday' })
  })
})
