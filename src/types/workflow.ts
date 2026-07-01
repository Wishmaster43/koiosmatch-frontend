/**
 * Workflow (automation graph) types. The editor works on a normalized UI shape
 * (steps with id/type/config/position/next); the API exposes a different shape,
 * so the raw types stay permissive and the mappers (data/workflowMap) translate.
 */

// One outgoing edge of a step: a target step id + an optional edge filter.
export interface StepConnection { target?: string | number | null; filters?: unknown }

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
  status?: string
  archived?: boolean          // soft-deleted; hidden unless the Archived view is on
  steps: WorkflowStep[]
  last_run?: WorkflowLastRun | null
  schedule?: unknown
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
  steps?: unknown[]
  workflow_steps?: unknown[]
  last_run?: WorkflowLastRun | null
  latest_run?: { created_at?: string; status?: string }
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
  type?: string
  data?: { filters?: unknown }
  [k: string]: unknown
}

// ── Editor config shapes (schedule · edge filters · config-panel fields) ──────
export interface FilterCondition { field?: string; operator?: string; value?: string }
export interface EdgeFilters { logic?: string; conditions?: FilterCondition[] }

export interface ScheduleConfig {
  schedule_type?: string
  interval_value?: number
  interval_unit?: string
  time?: string
  times?: string[]
  days_of_week?: number[]
  day_of_month?: number
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
  default?: unknown
  placeholder?: string
  [k: string]: unknown
}
