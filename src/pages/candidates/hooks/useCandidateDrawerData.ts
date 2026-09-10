/**
 * Candidate-drawer data hooks — per-tab fetches live here so the tab components
 * (ChangelogTab) stay presentational (§3: logic in hooks, not JSX).
 * GET-loads go through React Query (A-3: cached + dedup + signal-cancel), disabled
 * until their inputs exist and tolerant of a missing endpoint (empty, never a hard error).
 *
 * DRY (CANDHOOKS r10): the branch-membership hooks (useCandidateBranches,
 * useBranchLocationOptions) moved out of this file into
 * pages/candidates/drawer/useCandidateBranches.ts, co-located with their one real
 * consumer (BranchSection.tsx) — this file had exported them with no second consumer,
 * which read as shared infrastructure it never was.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { EntityActivityEvent } from '@/hooks/useEntityActivity'
import type { Id } from '@/types/common'

// DRY (CANDHOOKS r9): every field this entity's audit entry carries (id, causer,
// the C-16 subject/ip pair, the changes/properties diff, the Spatie event verb)
// now lives once on the shared EntityActivityEvent (hooks/useEntityActivity,
// also used by useVacancyActivity/useOpportunityActivity/useApplicationActivity/
// useMatchActivity) — this alias keeps this file's own name for its consumers.
export type ActivityEvent = EntityActivityEvent

// Candidate audit trail (C-16). 404 = endpoint not built yet → empty (calm), not an
// error. Returns the four-state building blocks the tab renders.
export function useCandidateActivity(id?: Id): { items: ActivityEvent[]; loading: boolean; error: boolean } {
  const { data = [], isLoading: loading, isError: error } = useQuery({
    queryKey: ['candidates', id, 'activity'],
    // Popover + Tijdlijn-tab can observe this query simultaneously (Opus
    // tijdlijn-verify measured a double GET on popover-open) — a short staleTime
    // lets the second observer reuse the first fetch.
    staleTime: 60_000,
    enabled: !!id,
    queryFn: async ({ signal }): Promise<ActivityEvent[]> => {
      try {
        const res = await api.get(`/candidates/${id}/activity`, { signal })
        return (unwrapList(res).rows) as ActivityEvent[]
      } catch (err) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) return []
        throw err
      }
    },
  })
  return { items: data, loading, error }
}
