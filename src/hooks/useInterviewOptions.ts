/**
 * useInterviewOptions — INTERVIEW-PICKER-AUTHZ-FE (option A, Danny 30-09): the
 * application drawer's Interview tab reads its workflow + agent pickers from
 * ONE narrow read endpoint gated on `applications.update`, instead of the two
 * management-list endpoints (`GET /workflows?kind=interview`, `GET /ai/agents`)
 * that a planner/recruitermanager may not have the right to view. Those two
 * hooks (useInterviewWorkflows, useAiAgents) keep serving every OTHER consumer
 * (VacancyAgentTab, AI management) — this hook exists only for the interview
 * tab's picker surface.
 *
 * The response carries NO 2xx schema in the OpenAPI spec (measured 30-09), so
 * the shape below is hand-written from the landed contract (api during-onix
 * eacf5b82): `{ workflows: [{id, name, agent: {id, name}|null}], agents: [{id,
 * name}] }`. `workflows` is already ACTIVE-only and interview-kind-only on the
 * server — there is no status field on the row, so `describeWorkflow` never
 * reports an inactive one (mirrors useInterviewWorkflows' own `describe` shape
 * so pickers need no adaptation, but the "still resolves an inactive linked
 * value" case does not apply here: the endpoint simply doesn't carry it).
 */
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api, { isForbidden } from '@/lib/api'
import { retryUnless, clientRetry } from '@/lib/queryRetry'
import type { Id } from '@/types/common'

// One pickable workflow row from the narrow endpoint — plain name, its derived agent.
export interface InterviewOptionWorkflow { id: Id; name: string; agent: { id: Id; name: string } | null }
export interface InterviewOptionAgent { id: Id; name: string }
interface InterviewOptionsResponse { workflows: InterviewOptionWorkflow[]; agents: InterviewOptionAgent[] }

export interface InterviewWorkflowOption { value: string; label: string }
export interface AiAgentOption { value: Id; label: string }

// Stable empty arrays so every consumer keeps one identity while loading (SEED-IDENTITY-1).
const NO_WORKFLOWS: InterviewOptionWorkflow[] = []
const NO_AGENTS: InterviewOptionAgent[] = []

// The interview tab's ONE picker source: workflow + agent options from the narrow
// `applications.update`-gated endpoint, one cached react-query entry per tenant.
export function useInterviewOptions(enabled: boolean = true) {
  const client = useQueryClient()
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['interview-options'],
    enabled,
    // INTERVIEW-403-1: a 403 is a role answer, never retried and never logged as a fault;
    // every other failure keeps the client's own retry policy.
    retry: retryUnless(isForbidden, clientRetry(client)),
    queryFn: async ({ signal }) => {
      const res = await api.get<InterviewOptionsResponse>('/applications/interview-options', { signal, quietStatuses: [403] })
      return res.data
    },
  })
  const workflows = data?.workflows ?? NO_WORKFLOWS
  const agents = data?.agents ?? NO_AGENTS

  const workflowOptions: InterviewWorkflowOption[] = useMemo(
    () => workflows.map(w => ({ value: String(w.id ?? ''), label: w.name ?? '' })),
    [workflows],
  )
  const workflowById = useMemo(() => new Map(workflows.map(w => [String(w.id), w])), [workflows])
  // Same shape as useInterviewWorkflows.describe — the endpoint is already
  // active-only, so `inactive` is always false here (there is no status field
  // to read one off); a value the list doesn't carry still resolves to null.
  const describeWorkflow = (id?: Id | null) => {
    if (id == null || id === '') return null
    const w = workflowById.get(String(id))
    if (!w) return null
    return { label: w.name ?? '', inactive: false }
  }

  const agentOptions: AiAgentOption[] = useMemo(
    () => agents.map(a => ({ value: a.id ?? '', label: a.name ?? '' })),
    [agents],
  )

  // `forbidden` (403) is reported apart from `error`, so a consumer renders a calm
  // "not for your role" notice instead of a red load-failure line.
  const forbidden = isForbidden(queryError)
  return {
    workflowOptions, workflowById, describeWorkflow,
    agentOptions, agents,
    loading: isLoading, error: isError && !forbidden, forbidden,
  }
}
