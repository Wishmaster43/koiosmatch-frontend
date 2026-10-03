/**
 * runStepApi — RUN-INSPECTOR-1: request helpers + response shapes for the
 * per-step inspector route (GET /workflow-runs/{run}/steps/{step}), typed from
 * the generated 2xx schema where the spec carries one (FINAL CONTRACT, BE
 * a08cc838); the nested `list` paginate envelope is hand-written since the
 * spec's example only shows `list?: string | null`. Field names live in ONE
 * place here so a BE rename at landing is a one-line change.
 */
import type { operations } from '@/types/api-generated'

// The step envelope's generated shape (data only; `list` below is hand-written).
export type RunStepDetailData = NonNullable<
  operations['getWorkflowRunsRunStepsStep']['responses'][200]['content']['application/json']['data']
>

// One row of the step's execution log (retries, AI turns, fan-out tallies) —
// generated shape re-typed with the loose `Record<string, never>` input/output
// widened to `unknown` (the spec's example gives an empty object, the real
// payload is any bundle).
export interface RunStepAttemptLogRow {
  attempt?: number
  status?: string
  input?: unknown
  output?: unknown
  error?: string | null
  executed_at?: string
}

export interface RunStepDetail extends Omit<RunStepDetailData, 'attempts_log' | 'output'> {
  output?: Record<string, unknown>
  attempts_log?: RunStepAttemptLogRow[]
}

// Hand-written: the spec's example for `list` is only `string | null`, but the
// FINAL CONTRACT names the real paginate envelope returned when `?list=` is sent.
export interface RunStepListPage {
  key: string
  data: unknown[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

export interface RunStepEnvelope {
  data?: RunStepDetail
  list?: RunStepListPage | null
}

// `?list=<key>&page=&per_page=` — per_page defaults to 50 server-side when omitted.
export interface RunStepListParams {
  list?: string
  page?: number
  per_page?: number
}
