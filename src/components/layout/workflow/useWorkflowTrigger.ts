/**
 * useWorkflowTrigger — the trigger/schedule/status form state, save serialization
 * and dirty-checking. Extracted from useWorkflowEditor (§3, split at ~400 lines):
 * this hook owns name/trigger/scheduleConfig/status and turns the live graph
 * (passed in from useWorkflowGraph) plus that form state into the persisted
 * workflow payload. No ReactFlow node/edge mutation lives here.
 */
import { useState, useCallback, useRef } from 'react'
import { computeWorkflowSnapshot, deriveStartTrigger, buildHeaderTriggerConfig } from './workflowEditorUtils'
import type { Workflow, FlowNode, FlowEdge, ScheduleConfig } from '@/types/workflow'
import { flowToSteps } from './serialization'

export function useWorkflowTrigger({ workflow, nodes, edges, initialNodes, initialEdges, onSave }: {
  workflow: Workflow
  nodes: FlowNode[]
  edges: FlowEdge[]
  // The graph's pre-deferral flow (useWorkflowGraph.initialNodes/initialEdges), used
  // ONLY to seed the dirty-check baseline below — `edges` itself starts empty and is
  // filled one tick later, so a baseline built from the live state on first render
  // would freeze a zero-edge snapshot and read a freshly-opened workflow as dirty
  // the moment its real edges land.
  initialNodes: FlowNode[]
  initialEdges: FlowEdge[]
  onSave: (updated: Workflow, closeAfter?: boolean) => void
}) {
  // Trigger config is opaque on the workflow; narrow it to the shapes we read.
  // WORKFLOW-SCHEMA-1: the scheduled trigger's fields sit FLAT on trigger_config
  // (frequency/times/weekdays/monthday/month/interval_minutes — no `schedule`
  // wrapper), same as event/agent already did. A legacy `schedule` object (the
  // old wrapped shape) is still read as a fallback so a workflow saved before
  // this change keeps rendering correctly.
  const triggerConfig = workflow.trigger_config as (ScheduleConfig & {
    // `schedule` is ambiguous by design: the OLD wrapped shape nested a full
    // ScheduleConfig object under it, the flat legacy shape uses it as a plain
    // frequency string ('weekly') — both are read below, narrowed by typeof.
    schedule?: ScheduleConfig | string | null; webhook_id?: string | number | null; event?: string; agent?: string
  }) | undefined

  // Reload seeding: 'event'/'agent' persist flat on trigger_config, so a reloaded
  // Event/Webhook(agent) trigger rebuilds its ScheduleConfig here — otherwise a
  // same-page reload + immediate re-save would wipe the binding (nextTriggerConfig
  // falls through to undefined; the exact class of bug this whole trigger_config
  // branch order guards against). For Scheduled, prefer the current flat shape
  // (any `frequency`/legacy time key present) and fall back to the old `schedule`
  // wrapper only for configs saved before this change.
  const hasFlatSchedule = triggerConfig != null && (
    'frequency' in triggerConfig || 'schedule_time' in triggerConfig || 'time' in triggerConfig
    || 'times' in triggerConfig || triggerConfig.schedule === 'weekly'
  )
  const legacyWrappedSchedule = typeof triggerConfig?.schedule === 'object' ? triggerConfig.schedule : null
  // Event/Webhook(agent)/DateRelative seed the WHOLE stored config, not just their
  // headline key: a seeded Event carries `conditions`, an agent webhook its `source`
  // lane, a DateRelative its date_field + offset_days — all lost before (WFB-03/05).
  const isKeyed = !!(triggerConfig?.event || triggerConfig?.agent || triggerConfig?.date_field != null)
  const initialScheduleConfig: ScheduleConfig | null = hasFlatSchedule ? (triggerConfig as ScheduleConfig)
    : legacyWrappedSchedule
    ?? (isKeyed ? { ...(triggerConfig as ScheduleConfig) } : null)

  const [name,           setName]           = useState(workflow.name)
  const [trigger,        setTrigger]        = useState(workflow.trigger)
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig | null>(initialScheduleConfig)
  const [webhookId]                         = useState<string | number | null>(triggerConfig?.webhook_id ?? null)
  const [status,         setStatus]         = useState(workflow.status || 'draft')
  const [saved,          setSaved]          = useState(false)

  // Dirty-check baseline (item 19): the snapshot right after load, computed via the
  // SAME serializer as the live snapshot below, so a freshly-opened workflow never
  // reads as dirty from a round-trip shape mismatch. Updated after every save.
  const savedSnapshotRef = useRef(
    computeWorkflowSnapshot(initialNodes, initialEdges, workflow.name, workflow.trigger,
      initialScheduleConfig, triggerConfig?.webhook_id ?? null, workflow.status || 'draft'),
  )

  // Serialize the graph back into workflow.steps and persist it; also refreshes
  // the dirty-check baseline so the just-saved state no longer reads as unsaved.
  const handleSave = useCallback((closeAfter = false) => {
    const steps = flowToSteps(nodes, edges)
    // audit module-schema-reconcile-4: a webhook/applicant_event START card is the
    // trigger the inbound route and the dispatcher match on — persist it as such.
    const start = deriveStartTrigger(steps)
    if (start) {
      onSave({ ...workflow, name, trigger: start.trigger, trigger_config: start.triggerConfig, status, steps }, closeAfter)
      savedSnapshotRef.current = computeWorkflowSnapshot(nodes, edges, name, trigger, scheduleConfig, webhookId, status)
      if (!closeAfter) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
      return
    }
    // The ONE builder the dirty-check snapshot uses too (workflowEditorUtils).
    const nextTriggerConfig = buildHeaderTriggerConfig(trigger, scheduleConfig, webhookId)
    onSave({ ...workflow, name, trigger, trigger_config: nextTriggerConfig, status, steps }, closeAfter)
    // A save just persisted the current state — it's the new dirty-check baseline.
    savedSnapshotRef.current = computeWorkflowSnapshot(nodes, edges, name, trigger, scheduleConfig, webhookId, status)
    if (!closeAfter) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [nodes, edges, workflow, name, trigger, scheduleConfig, webhookId, status, onSave])

  // Dirty-check (item 19): true when the live graph/name/trigger/schedule/status
  // differ from the last-saved baseline — serialize-compare via the shared
  // computeWorkflowSnapshot so it stays cheap and never drifts from handleSave.
  const isDirty = useCallback(
    () => computeWorkflowSnapshot(nodes, edges, name, trigger, scheduleConfig, webhookId, status) !== savedSnapshotRef.current,
    [nodes, edges, name, trigger, scheduleConfig, webhookId, status],
  )

  return {
    name, setName, trigger, setTrigger, scheduleConfig, setScheduleConfig, webhookId, status, setStatus,
    saved, handleSave, isDirty,
  }
}
