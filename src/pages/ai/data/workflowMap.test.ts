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

  it('maps trigger_type onto the editor trigger word and keeps the API label aside as trigger_label (WFB-01)', () => {
    const wf = normalizeWorkflow({ trigger: 'Wekelijks (ma, do) 08:00', trigger_type: 'scheduled', steps: [] })
    expect(wf.trigger).toBe('Scheduled')
    expect(wf.trigger_label).toBe('Wekelijks (ma, do) 08:00')
    expect(normalizeWorkflow({ trigger: 'Bij gebeurtenis: application.created', trigger_type: 'event', steps: [] }).trigger).toBe('Event')
    expect(normalizeWorkflow({ trigger: 'Datum-relatief', trigger_type: 'date_relative', steps: [] }).trigger).toBe('DateRelative')
    expect(normalizeWorkflow({ trigger: 'Webhook', trigger_type: 'webhook', steps: [] }).trigger).toBe('Webhook')
    expect(normalizeWorkflow({ trigger: 'Handmatig', trigger_type: 'manual', steps: [] }).trigger).toBe('Handmatig')
    expect(normalizeWorkflow({ steps: [] }).trigger).toBe('Handmatig')
  })

  it('keeps each step\'s label (seeded templates name their steps) — WFB-04', () => {
    const wf = normalizeWorkflow({ steps: [{ id: 's1', module_type: 'experience_add', label: 'Werkervaring toevoegen' }, { id: 's2', module_type: 'email' }] })
    expect(wf.steps[0].label).toBe('Werkervaring toevoegen')
    expect(wf.steps[1]).not.toHaveProperty('label')
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

  it('keeps a DateRelative trigger verbatim — never re-tagged scheduled (DATE-REL-RUNNER-1)', () => {
    expect(denormalizeWorkflow(base({ trigger: 'DateRelative', trigger_config: { date_field: 'match.end_date', offset_days: -28 } } as Partial<Workflow>)))
      .toMatchObject({ trigger_type: 'date_relative', trigger_config: { date_field: 'match.end_date', offset_days: -28 } })
  })

  it('recognizes any trigger string containing "webhook" (case-insensitive)', () => {
    expect(denormalizeWorkflow(base({ trigger: 'Webhook' }))).toMatchObject({ trigger_type: 'webhook' })
    expect(denormalizeWorkflow(base({ trigger: 'via webhook' }))).toMatchObject({ trigger_type: 'webhook' })
  })

  it('legacy: a schedule label with no structured type and no config contributes only its embedded time', () => {
    const withTime = denormalizeWorkflow(base({ trigger: 'Dagelijks 08:00' }))
    expect(withTime.trigger_type).toBe('scheduled')
    expect(withTime.trigger_config).toEqual({ schedule_time: '08:00' })

    const noTime = denormalizeWorkflow(base({ trigger: 'Elk uur' }))
    expect(noTime.trigger_type).toBe('scheduled')
    expect(noTime.trigger_config).toEqual({})
  })

  it('maps the header word "Direct" to manual — the backend has no instant type; a data-driven start is the start card', () => {
    expect(denormalizeWorkflow(base({ trigger: 'Direct' }))).toMatchObject({ trigger_type: 'manual', trigger_config: {} })
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
        connections: [{ target: 'b', filters: { conditions: [], logic: 'AND' }, label: null, source_handle: 'out', target_handle: 'in' }],
      },
      { id: null, module_type: 'email', config: {}, label: null, order: 1, position: null, connections: [] },
    ])
  })

  // Router branch contract: a connection's label/source_handle/target_handle must
  // survive denormalize verbatim — the previous mapper dropped them, which collapsed
  // every seeded Router branch to the default 'out'/'in' port on the very next save.
  it('preserves a connection\'s label/source_handle/target_handle (Router branch round-trip)', () => {
    const payload = denormalizeWorkflow(base({
      steps: [{ id: 'a', type: 'router', next: [
        { target: 'b', filters: null, label: 'WhatsApp-toestemming', source_handle: 'route-1', target_handle: 'in' },
      ] }],
    }))
    expect(payload.steps[0].connections).toEqual([
      { target: 'b', filters: null, label: 'WhatsApp-toestemming', source_handle: 'route-1', target_handle: 'in' },
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

// AI-AGENTS-3: a webhook trigger must round-trip its config too — dropping it to
// {} unconditionally (the code before this fix) silently unbinds a live workflow
// from its AI agent (or its legacy webhook resource) on the very next save.
describe('denormalizeWorkflow · webhook trigger (request body)', () => {
  it('ships trigger_type webhook with the editor-built agent config (AI-agent flavor)', () => {
    const wf = { name: 'AI Recruiter', trigger: 'Webhook', trigger_config: { agent: 'Michelle' }, status: 'active', steps: [] }
    const out = denormalizeWorkflow(wf as never)
    expect(out.trigger_type).toBe('webhook')
    expect(out.trigger_config).toMatchObject({ agent: 'Michelle' })
  })

  it('falls back to webhook_id when no agent is set (legacy generic-webhook flavor)', () => {
    const wf = { name: 'Legacy', trigger: 'Webhook', trigger_config: { webhook_id: 'wh1' }, status: 'active', steps: [] }
    const out = denormalizeWorkflow(wf as never)
    expect(out.trigger_type).toBe('webhook')
    expect(out.trigger_config).toMatchObject({ webhook_id: 'wh1' })
  })

  it('ships an empty trigger_config when neither agent nor webhook_id is set yet', () => {
    const wf = { name: 'Fresh', trigger: 'Webhook', status: 'active', steps: [] }
    const out = denormalizeWorkflow(wf as never)
    expect(out.trigger_type).toBe('webhook')
    expect(out.trigger_config).toEqual({})
  })
})

// WFB-01/02/03/05 (CMBE contract audit 09-09): a workflow that came back from the API
// carries the HUMAN trigger label plus the structured trigger_type/trigger_config. A
// status toggle or folder move denormalizes that object as-is — it must ship the
// structured type and the config VERBATIM, never a re-parse of the label.
describe('denormalizeWorkflow · API round-trip keeps trigger_type + trigger_config verbatim', () => {
  const fromApi = (raw: RawWorkflow) => normalizeWorkflow(raw)

  it('scheduled: the whole flat schedule survives, not a {schedule_label, schedule_time} rebuild (WFB-02)', () => {
    const cfg = { frequency: 'weekly', times: ['08:00'], weekdays: [1, 4] }
    const out = denormalizeWorkflow(fromApi({ trigger: 'Wekelijks (ma, do) 08:00', trigger_type: 'scheduled', trigger_config: cfg, steps: [] }))
    expect(out.trigger_type).toBe('scheduled')
    expect(out.trigger_config).toEqual(cfg)
  })

  it('event: the label "Bij gebeurtenis: …" is never re-tagged scheduled and `conditions` ride along (WFB-01/03)', () => {
    const cfg = { event: 'application.stage_changed', conditions: { stage_flag: 'is_rejected' } }
    const out = denormalizeWorkflow(fromApi({ trigger: 'Bij gebeurtenis: application.stage_changed', trigger_type: 'event', trigger_config: cfg, steps: [] }))
    expect(out.trigger_type).toBe('event')
    expect(out.trigger_config).toEqual(cfg)
  })

  it('date_relative: "Datum-relatief" keeps date_field + offset_days (WFB-01)', () => {
    const cfg = { date_field: 'match.end_date', offset_days: -28 }
    const out = denormalizeWorkflow(fromApi({ trigger: 'Datum-relatief', trigger_type: 'date_relative', trigger_config: cfg, steps: [] }))
    expect(out).toMatchObject({ trigger_type: 'date_relative', trigger_config: cfg })
  })

  it('webhook: the agent name AND the source lane survive (WFB-05)', () => {
    const cfg = { agent: 'Michelle', source: 'wa_web' }
    const out = denormalizeWorkflow(fromApi({ trigger: 'Webhook', trigger_type: 'webhook', trigger_config: cfg, steps: [] }))
    expect(out).toMatchObject({ trigger_type: 'webhook', trigger_config: cfg })
  })

  it('manual: the label "Handmatig" ships an empty config even when a stale config is present', () => {
    const out = denormalizeWorkflow(fromApi({ trigger: 'Handmatig', trigger_type: 'manual', trigger_config: { times: ['09:00'] }, steps: [] }))
    expect(out).toMatchObject({ trigger_type: 'manual', trigger_config: {} })
  })

  it('a step label from the API is sent back on save, not nulled (WFB-04)', () => {
    const out = denormalizeWorkflow(fromApi({ steps: [{ id: 's1', module_type: 'experience_add', label: 'Werkervaring toevoegen' }] }))
    expect(out.steps[0].label).toBe('Werkervaring toevoegen')
  })

  it('the editor word still wins over a stale structured type (the modal switched the trigger)', () => {
    const wf = { ...fromApi({ trigger: 'Wekelijks 08:00', trigger_type: 'scheduled', trigger_config: { frequency: 'weekly' }, steps: [] }), trigger: 'Event', trigger_config: { event: 'candidate.birthday' } }
    expect(denormalizeWorkflow(wf)).toMatchObject({ trigger_type: 'event', trigger_config: { event: 'candidate.birthday' } })
  })
})
