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

// A normalized workflow (editor/UI shape).
export interface Workflow {
  id?: string | number
  name?: string
  trigger?: string
  trigger_type?: string       // 'scheduled' | 'webhook' | 'manual' — drives the list-row trigger icon
  status?: string
  archived?: boolean          // soft-deleted; hidden unless the Archived view is on
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
  data?: { filters?: unknown; label?: string }
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

export interface ScheduleConfig {
  schedule_type?: string
  interval_value?: number
  interval_unit?: string
  time?: string
  times?: string[]
  days_of_week?: number[]
  day_of_month?: number
  // Event trigger (BIRTHDAY-FLOW-2): the chosen domain-event key.
  event?: string
  // Webhook trigger, AI-agent flavor (AI-AGENTS-3): the agent name this
  // workflow's own webhook is coupled to (backend matches by NAME, not id).
  agent?: string
  month?: number
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
  [k: string]: unknown
}
