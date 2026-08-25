/**
 * Workflow (automation graph) types. The editor works on a normalized UI shape
 * (steps with id/type/config/position/next); the API exposes a different shape,
 * so the raw types stay permissive and the mappers (data/workflowMap) translate.
 */

// One outgoing edge of a step: a target step id + an optional edge filter.
export interface StepConnection { target?: string | number | null; filters?: unknown; source_handle?: string; target_handle?: string; label?: string | null }

// A normalized step in the editor graph.
export interface WorkflowStep {
  id?: string
  type?: string
  config?: Record<string, unknown>
  position?: unknown
  next?: StepConnection[]
  label?: string
  [k: string]: unknown
}

// The last-run summary shown on a workflow card.
export interface WorkflowLastRun { time?: string; ok?: boolean; candidates?: number; error?: string; [k: string]: unknown }

// One row of a workflow's parent/child tree (WF-RELATIONS-FE-1,
// GET /workflows/{id}/relations → { parents: [...], children: [...] }).
export interface WorkflowRelation {
  id: string | number
  name?: string
  status?: string
  runs_count?: number
  last_run_at?: string | null
  last_run_status?: string | null
}

// A normalized workflow (editor/UI shape).
export interface Workflow {
  id?: string | number
  name?: string
  trigger?: string
  trigger_type?: string       // 'scheduled' | 'webhook' | 'manual' — drives the list-row trigger icon
  status?: string
  archived?: boolean          // soft-deleted; hidden unless the Archived view is on
  // TRASH-OVERAL-2: trash lifecycle + pending-erase stamp (normalizeWorkflow derives
  // a tolerant fallback for payloads that predate the fields).
  lifecycle?: 'active' | 'archived' | 'pending_erase'
  pending_erase_at?: string | null
  folder_id?: string | number | null
  steps: WorkflowStep[]
  last_run?: WorkflowLastRun | null
  schedule?: unknown
  created_at?: string
  updated_at?: string         // shown (formatted) in the list-row meta line
  runs_count?: number
  [k: string]: unknown
}

// ── Raw API shapes (pre-normalize / post-denormalize) — deliberately permissive ──
export interface RawConnection { target?: unknown; filters?: unknown; [k: string]: unknown }
export interface RawStep {
  id?: string | number
  module_type?: string
  type?: string
  config?: Record<string, unknown>
  parameters?: Record<string, unknown>
  position?: unknown
  next?: RawConnection[]
  connections?: RawConnection[]
  label?: string
  [k: string]: unknown
}
export interface RawWorkflow {
  trigger?: unknown
  trigger_type?: string
  status?: unknown
  active?: boolean
  folder_id?: string | number | null
  steps?: unknown[]
  workflow_steps?: unknown[]
  last_run?: WorkflowLastRun | null
  latest_run?: { created_at?: string; status?: string }
  created_at?: string
  updated_at?: string
  runs_count?: number
  [k: string]: unknown
}

// ── ReactFlow graph shapes (canvas editor) ───────────────────────────────────
export interface FlowNodeData { type?: string; config?: Record<string, unknown>; isFirst?: boolean; [k: string]: unknown }
export interface FlowNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: FlowNodeData
  width?: number
  height?: number
  [k: string]: unknown
}
export interface FlowEdge {
  id: string
  source: string
  target: string
  // React Flow handle ids — must match a <Handle id=…> on the node, else the edge is
  // dropped. 'out'/'in' by default; a router sets its branch-key as sourceHandle.
  sourceHandle?: string
  targetHandle?: string
  type?: string
  // filters = the route condition; label = the route name (Router, Make-style).
  // sourceHandleRaw/targetHandleRaw preserve the ORIGINAL seeded handle id (e.g.
  // 'route-1') when it was normalized to 'out'/'in' for rendering, so a future
  // multi-handle router node can restore the real port on load.
  data?: { filters?: unknown; label?: string; sourceHandleRaw?: string; targetHandleRaw?: string }
  [k: string]: unknown
}

// ── Editor config shapes (schedule · edge filters · config-panel fields) ──────
export interface FilterCondition { field?: string; operator?: string; value?: string }
export interface EdgeFilters { logic?: string; conditions?: FilterCondition[] }

// One AND-group of conditions inside a router edge's OR'ed group set. A single
// group is the legacy `EdgeFilters` shape (backward compatible); ≥2 groups
// persist as the backend FilterEvaluator's nested `[[…],[…]]` OR-group contract
// (see EdgeFilterPanel.tsx / serialization.ts for the exact conversion).
export type FilterConditionGroup = FilterCondition[]

// WORKFLOW-SCHEMA-1: the `scheduled` trigger's config matches the backend
// contract's `trigger_config` fields directly (no wrapper). `[k: string]:
// unknown` also carries the legacy read-only shapes (`schedule_time`,
// `schedule: 'weekly'`, `day`, bare `times` with no `frequency`) that
// normalizeScheduleConfig (scheduleLabel.ts) still knows how to read.
export interface ScheduleConfig {
  frequency?: string
  times?: string[]
  weekdays?: number[]
  monthday?: number
  month?: number
  interval_minutes?: number
  // Event trigger (BIRTHDAY-FLOW-2): the chosen domain-event key.
  event?: string
  // Webhook trigger, AI-agent flavor (AI-AGENTS-3): the agent name this
  // workflow's own webhook is coupled to (backend matches by NAME, not id).
  agent?: string
  [k: string]: unknown
}

// One selectable output field of an upstream module, insertable as a token.
export interface WorkflowVarField {
  token: string   // the literal to insert, e.g. "{{n_ab12.firstname}}"
  label: string   // the field path shown in the picker, e.g. "firstname"
  sample?: string // a short preview of the value from the last test run
}
// All variables offered by one upstream module (one group in the picker).
export interface WorkflowVarGroup {
  nodeId: string
  moduleType: string
  customName?: string      // the node's own name (config.naam), when set
  hasRun: boolean          // true when the module has a test-run output
  fields: WorkflowVarField[]
}

// One selectable option in a config-panel field.
export interface FieldOption { value: string; label: string }
// A module config-panel field (schema entry the FieldInput renders).
export interface WorkflowField {
  key: string
  type?: string
  label?: string
  fields?: Array<string | FieldOption>
  options?: Array<string | FieldOption>
  // WF-MULTISELECT-1: tenant-lookup source for multiselect (candidate_statuses/phases/types).
  source?: string
  default?: unknown
  placeholder?: string
  // K-193: a field the user must fill before the step can run (the builder marks
  // it and shows a hint; the backend still fails a missing value visibly).
  required?: boolean
  [k: string]: unknown
}
