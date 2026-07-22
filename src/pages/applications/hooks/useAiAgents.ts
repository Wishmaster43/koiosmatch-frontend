/**
 * useAiAgents — AI agent options + the raw agent list (INTERVIEW-PERAPP-1 Flow
 * B: the per-application "start interview" agent picker in InterviewsTab).
 * Mirrors the vacancy feature's own copy 1:1 (src/pages/vacancies/hooks/
 * useAiAgents.ts) — kept as a small, entity-scoped hook rather than a
 * cross-folder import (§2: an entity page never imports another entity's
 * internals). Both hooks share the same react-query key, so the two features
 * still hit one cache entry; a `src/hooks/` consolidation is a reasonable
 * follow-up once a third caller needs it.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'
import type { AiAgent } from '@/types/ai'

export interface AiAgentOption { value: Id; label: string }
export interface UseAiAgentsResult { options: AiAgentOption[]; agents: AiAgent[]; loading: boolean; error: boolean }

export function useAiAgents(enabled: boolean = true): UseAiAgentsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-agents'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<AiAgent>(await api.get('/ai/agents', { signal }))
      return rows
    },
  })
  const agents = data ?? []
  const options = agents.map(a => ({ value: a.id ?? '', label: a.name ?? '' }))
  return { options, agents, loading: isLoading, error: isError }
}
