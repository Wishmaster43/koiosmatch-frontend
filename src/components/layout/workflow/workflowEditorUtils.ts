/**
 * workflowEditorUtils — the pure, unit-tested functions extracted from
 * useWorkflowEditor (§3, split at ~400 lines): sample flattening, var-field
 * building, and the save/dirty-check snapshot serializer. No React state here —
 * these are re-exported from useWorkflowEditor.ts so existing test imports and
 * the hook's internal usage keep working unchanged.
 */
import { flowToSteps } from './serialization'
import type { FlowNode, FlowEdge, ScheduleConfig, WorkflowVarField } from '@/types/workflow'

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

// Build the persistable snapshot the same way handleSave does, so the dirty-check
// (item 19) and the baseline it's compared against serialize identically — no
// false "dirty" from a shape mismatch between the raw workflow prop and the
// derived save payload. Exported for unit testing.
export function computeWorkflowSnapshot(
  nodes: FlowNode[], edges: FlowEdge[], name: string | undefined, trigger: string | undefined,
  scheduleConfig: ScheduleConfig | null, webhookId: string | number | null, status: string,
): string {
  const steps = flowToSteps(nodes, edges)
  let triggerConfig: Record<string, unknown> | undefined
  // AI-AGENTS-3: a webhook trigger set via the ScheduleModal's agent picker carries
  // scheduleConfig.agent — checked BEFORE the legacy webhook_id flavor (both share
  // the 'Webhook' trigger label) so the new flow never falls through and silently
  // loses its config, the exact fall-through bug the Event branch once had.
  if (trigger === 'Webhook' && scheduleConfig?.agent) triggerConfig = { agent: scheduleConfig.agent }
  else if (trigger === 'Webhook' && webhookId) triggerConfig = { webhook_id: webhookId }
  else if (trigger === 'Scheduled' && scheduleConfig) triggerConfig = { schedule: scheduleConfig }
  // Event trigger (BIRTHDAY-FLOW-2): trigger_config carries only the event key,
  // matching the backend contract (Workflow::trigger_config['event']).
  else if (trigger === 'Event' && scheduleConfig?.event) triggerConfig = { event: scheduleConfig.event }
  return JSON.stringify({ name, trigger, trigger_config: triggerConfig, status, steps })
}
