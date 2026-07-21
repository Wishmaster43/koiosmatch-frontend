/**
 * useAiAgents — AI agent options + the raw agent list for the vacancy AI-agent tab
 * (VAC-AGENT-1, moved onto its own tab 2026-07-21). `agents` carries the full record
 * (including `interview_flow`) so the tab can look up the linked agent's interview
 * design; `options` is the {value,label} shape the picker renders.
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
