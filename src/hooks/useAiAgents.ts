/**
 * useAiAgents — AI agent options + the raw agent list, shared by every entity
 * that offers an agent picker (applications' InterviewsTab agent picker,
 * INTERVIEW-PERAPP-1 Flow B; the vacancy AI-agent tab, VAC-AGENT-1). Both
 * entity-scoped wrappers (src/pages/applications/hooks/useAiAgents.ts and
 * src/pages/vacancies/hooks/useAiAgents.ts) re-export this one implementation
 * so their existing import paths keep working unchanged. `agents` carries the
 * full record (including `interview_flow`) so a caller can look up the linked
 * agent's interview design; `options` is the {value,label} shape a picker renders.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'
import type { AiAgent } from '@/types/ai'

export interface AiAgentOption { value: Id; label: string }
export interface UseAiAgentsResult { options: AiAgentOption[]; agents: AiAgent[]; loading: boolean; error: boolean }

// A stable empty array so `agents`/`options` keep one identity while loading, never a fresh literal per render (SEED-IDENTITY-1).
const NO_AGENTS: AiAgent[] = []

// The tenant's AI agent picker options + the raw list, one cached react-query entry shared across every consumer.
export function useAiAgents(enabled: boolean = true): UseAiAgentsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-agents'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<AiAgent>(await api.get('/ai/agents', { signal }))
      return rows
    },
  })
  const agents = data ?? NO_AGENTS
  // Memoised: `agents` only gets a new identity when the query data actually changes.
  const options = useMemo(() => agents.map(a => ({ value: a.id ?? '', label: a.name ?? '' })), [agents])
  return { options, agents, loading: isLoading, error: isError }
}
