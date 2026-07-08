/**
 * useWorkflowRun — polls one workflow run for live per-step status (WF-R3).
 * React Query refetches ~1s while the run is pending/running and stops once it
 * reaches a terminal state, so the canvas node colours + the run-viewer update
 * live without a manual refresh. Endpoint: GET /workflow-runs/{runId}.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { RunRow } from '@/types/reports'

// Statuses that mean the run is finished — polling stops here. Exported so the
// editor can seed node outputs from the finished run's steps.
export const TERMINAL = new Set(['success', 'failed', 'error', 'cancelled', 'completed'])

export function useWorkflowRun(runId: string | number | null | undefined) {
  const { data } = useQuery<RunRow>({
    queryKey: ['workflow-run', runId],
    enabled: runId != null,
    queryFn: async ({ signal }) => {
      const body = (await api.get(`/workflow-runs/${runId}`, { signal })).data
      return (body?.data ?? body) as RunRow
    },
    // Poll while running; stop (false) once terminal or unknown.
    refetchInterval: query => {
      const status = query.state.data?.status
      return status && !TERMINAL.has(status) ? 1000 : false
    },
  })
  return data ?? null
}
