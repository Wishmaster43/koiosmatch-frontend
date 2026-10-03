/**
 * useRunStepDetail — RUN-INSPECTOR-1: react-query hooks for the per-step
 * inspector route (GET /workflow-runs/{run}/steps/{step}). `useRunStepDetail`
 * loads the full envelope (every list key capped at its first page);
 * `useRunStepListPage` pages through ONE list key on demand (the inspector's
 * load-more button). A 403 is a role answer (INTERVIEW-403-1), never retried.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api, { isForbidden } from '@/lib/api'
import { resolveWorkflowBaseURL } from '@/lib/workflowApi'
import { retryUnless, clientRetry } from '@/lib/queryRetry'
import type { RunStepEnvelope, RunStepListParams } from './runStepApi'

// The full step envelope — input/output/attempts_log, every list capped at its first page.
export function useRunStepDetail(
  runId: string | number | null | undefined,
  stepId: string | number | null | undefined,
  enabled: boolean = true,
) {
  const client = useQueryClient()
  const { data, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['workflow-run-step', runId, stepId],
    enabled: enabled && runId != null && stepId != null,
    retry: retryUnless(isForbidden, clientRetry(client)),
    queryFn: async ({ signal }) => {
      const res = await api.get<RunStepEnvelope>(`/workflow-runs/${runId}/steps/${stepId}`, {
        signal, baseURL: resolveWorkflowBaseURL(), quietStatuses: [403],
      })
      return res.data
    },
  })
  const forbidden = isForbidden(queryError)
  return { step: data?.data ?? null, loading: isLoading, error: isError && !forbidden, forbidden, refetch }
}

// One output-list key, one page — the inspector's "load more" for a list key
// longer than its first page. Disabled until the caller asks for a page (`page`
// stays undefined until the user clicks load-more).
export function useRunStepListPage(
  runId: string | number | null | undefined,
  stepId: string | number | null | undefined,
  params: RunStepListParams | null,
) {
  const client = useQueryClient()
  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ['workflow-run-step-list', runId, stepId, params?.list, params?.page, params?.per_page],
    enabled: runId != null && stepId != null && !!params?.list,
    retry: retryUnless(isForbidden, clientRetry(client)),
    queryFn: async ({ signal }) => {
      const res = await api.get<RunStepEnvelope>(`/workflow-runs/${runId}/steps/${stepId}`, {
        signal, baseURL: resolveWorkflowBaseURL(), params, quietStatuses: [403, 422],
      })
      return res.data
    },
  })
  const forbidden = isForbidden(queryError)
  // The raw error object travels along so the caller can surface a 422's server
  // message (e.g. "not a paginated list for this caller") instead of swallowing it.
  return { page: data?.list ?? null, loading: isLoading, error: isError && !forbidden, forbidden, errorObj: queryError }
}
