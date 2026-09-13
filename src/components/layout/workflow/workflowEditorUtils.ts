/**
 * workflowEditorUtils — the pure, unit-tested functions extracted from
 * useWorkflowEditor (§3, split at ~400 lines): sample flattening, var-field
 * building, and the save/dirty-check snapshot serializer. No React state here —
 * these are re-exported from useWorkflowEditor.ts so existing test imports and
 * the hook's internal usage keep working unchanged.
 */
import { flowToSteps, mkEdge } from './serialization'
import type { FlowNode, FlowEdge, ScheduleConfig, WorkflowVarField } from '@/types/workflow'

// CONSENT-BEHOUD-1: whenever a graph mutation re-links two nodes with a NEW edge
// standing in for an existing one (router splice, module insert-on-edge, node
// delete-and-relink), the new edge must inherit the original edge's `data`
// (filters like whatsapp_consent, label, raw route handles) — a bare mkEdge()
// silently drops it. Centralised here (previously duplicated at three call
// sites in useWorkflowEditor, now in useWorkflowGraph) so every site shares
// one rule.
export function mkEdgePreservingData(source: string, target: string, data: FlowEdge['data']): FlowEdge {
  return { ...mkEdge(source, target), data }
}

// Flatten a test-run sample into dot-paths (max depth 2, capped) for the var
// picker. An array is represented by the shape of its first element.
// Exported for unit testing.
export function flattenSample(obj: unknown, prefix = '', depth = 0): Array<{ path: string; sample: string }> {
  if (obj == null) return []
  if (typeof obj !== 'object') return prefix ? [{ path: prefix, sample: String(obj) }] : []
  if (Array.isArray(obj)) return obj.length ? flattenSample(obj[0], prefix, depth) : []
  const out: Array<{ path: string; sample: string }> = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 1) {
      out.push(...flattenSample(v, path, depth + 1))
    } else {
      out.push({ path, sample: Array.isArray(v) ? `[${v.length}]` : v == null ? '' : String(v) })
    }
    if (out.length > 60) break
  }
  return out
}

// Build the insertable variable fields for one node's output (pure; unit-tested).
// Bundle expansion (CMBE 2026-07-09, Danny blocked on picking): a LIST output field
// (candidates [8]) runs PER ITEM in send-modules, so item[0]'s keys are the valid
// placeholders — exposed as flat {{field}} tokens (dot-paths like user.email via
// flattenSample). The list summary row is dropped; duplicate names dedupe by token.
// Scalar fields keep the node-scoped {{node.field}} token; no run → whole-output token.
export function buildVarFields(nodeId: string, out: unknown): WorkflowVarField[] {
  const hasRun = out != null
  const flat = hasRun ? flattenSample(out) : []
  const bundleFields: WorkflowVarField[] = []
  const bundleKeys = new Set<string>()
  if (hasRun && out && typeof out === 'object') {
    const entries: Array<[string, unknown]> = Array.isArray(out) ? [['', out]] : Object.entries(out as Record<string, unknown>)
    const seenTokens = new Set<string>()
    for (const [k, v] of entries) {
      if (!Array.isArray(v) || !v.length || typeof v[0] !== 'object' || v[0] == null) continue
      bundleKeys.add(k)
      for (const f of flattenSample(v[0])) {
        const token = `{{${f.path}}}`
        if (seenTokens.has(token)) continue
        seenTokens.add(token)
        bundleFields.push({ token, label: f.path, sample: f.sample })
      }
    }
  }
  // A top-level array IS one bundle — no scalar duplicates then.
  const scalarFields = Array.isArray(out) ? [] : flat
    .filter(f => !bundleKeys.has(f.path))
    .map(f => ({ token: `{{${nodeId}.${f.path}}}`, label: f.path, sample: f.sample }))
  return (hasRun && (bundleFields.length || scalarFields.length))
    ? [...bundleFields, ...scalarFields]
    : [{ token: `{{${nodeId}}}`, label: '' }]
}

// audit module-schema-reconcile-4 (CMBE 686d8b74, measured 03-09): the applicant_event
// card lists human labels; the dispatcher fires application.created / application.
// stage_changed and filters a stage change on `trigger_config.conditions.stage_flag`,
// a FLAG of the stage moved to (is_rejected / is_match) — never a slug, because stage
// slugs are tenant-configurable (§3B). No application.rejected/hired event exists.
const APPLICANT_EVENT_KEYS: Record<string, Record<string, unknown>> = {
  'nieuwe sollicitatie': { event: 'application.created' },
  'fase gewijzigd':      { event: 'application.stage_changed' },
  'afgewezen':           { event: 'application.stage_changed', conditions: { stage_flag: 'is_rejected' } },
  'aangenomen':          { event: 'application.stage_changed', conditions: { stage_flag: 'is_match' } },
}

// The inbound-webhook route and the event dispatcher match on the WORKFLOW's
// trigger_type/trigger_config, not on the start card's own config — so a graph whose
// first step is the webhook or applicant_event card persists that card AS the trigger.
// Returns null for every other start card (the header trigger picker then rules).
export function deriveStartTrigger(steps: Array<{ type?: string; config?: Record<string, unknown> }>):
  { trigger: string; triggerConfig: Record<string, unknown> } | null {
  const first = steps[0]
  if (!first) return null
  if (first.type === 'webhook') {
    const webhookId = first.config?.webhook_id
    return webhookId ? { trigger: 'Webhook', triggerConfig: { webhook_id: webhookId } } : null
  }
  if (first.type === 'applicant_event') {
    const mapped = APPLICANT_EVENT_KEYS[String(first.config?.event ?? '')]
    return mapped ? { trigger: 'Event', triggerConfig: { ...mapped } } : null
  }
  return null
}

// Build the persistable snapshot the same way handleSave does, so the dirty-check
// (item 19) and the baseline it's compared against serialize identically — no
// false "dirty" from a shape mismatch between the raw workflow prop and the
// derived save payload. Exported for unit testing.
export function computeWorkflowSnapshot(
  nodes: FlowNode[], edges: FlowEdge[], name: string | undefined, trigger: string | undefined,
  scheduleConfig: ScheduleConfig | null, webhookId: string | number | null, status: string,
): string {
  const steps = flowToSteps(nodes, edges)
  // A webhook/applicant_event start card overrides the header trigger (see deriveStartTrigger).
  const start = deriveStartTrigger(steps)
  if (start) return JSON.stringify({ name, trigger: start.trigger, trigger_config: start.triggerConfig, status, steps })
  const triggerConfig = buildHeaderTriggerConfig(trigger, scheduleConfig, webhookId)
  return JSON.stringify({ name, trigger, trigger_config: triggerConfig, status, steps })
}

// The header trigger's persisted trigger_config, shared by handleSave and the
// dirty-check snapshot so the two can never disagree. The ScheduleModal's config is
// the flat backend contract already (WORKFLOW-SCHEMA-1), so it is passed through
// WHOLE per trigger word — never re-picked field by field: that is how a reloaded
// Event lost its `conditions`, a Webhook its `source` lane and a DateRelative its
// date_field/offset_days on the very next save (WFB-02/03/05, 09-09).
export function buildHeaderTriggerConfig(
  trigger: string | undefined, scheduleConfig: ScheduleConfig | null, webhookId: string | number | null,
): Record<string, unknown> | undefined {
  // AI-AGENTS-3: the agent flavor is checked BEFORE the legacy webhook_id flavor
  // (both share the 'Webhook' word) so it never falls through to the legacy branch.
  if (trigger === 'Webhook' && scheduleConfig?.agent) return flatTriggerConfig(scheduleConfig)
  if (trigger === 'Webhook' && webhookId) return { webhook_id: webhookId }
  if ((trigger === 'Scheduled' || trigger === 'Event' || trigger === 'DateRelative') && scheduleConfig) return flatTriggerConfig(scheduleConfig)
  return undefined
}

// The modal's config minus the pre-WORKFLOW-SCHEMA-1 `schedule_type` wrapper key, which
// older editor state may still carry and the backend contract does not know.
function flatTriggerConfig(cfg: ScheduleConfig): Record<string, unknown> {
  const flat: Record<string, unknown> = { ...cfg }
  delete flat.schedule_type
  return flat
}
