/**
 * useAiAgents — AI agent picker options for the vacancy Details editor (VAC-AGENT-1).
 * Fetched only while editing (mirrors useCustomerOptions). Linking an agent IS the
 * interview on/off switch for this vacancy (Option A: the agent carries its own
 * interview flow), so this hook only ever surfaces id + name — no separate flow list.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'
import type { AiAgent } from '@/types/ai'

export interface AiAgentOption { value: Id; label: string }
export interface UseAiAgentsResult { options: AiAgentOption[]; loading: boolean; error: boolean }

export function useAiAgents(enabled: boolean): UseAiAgentsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-agents', 'options'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<AiAgent>(await api.get('/ai/agents', { signal }))
      return rows.map(a => ({ value: a.id ?? '', label: a.name ?? '' })) as AiAgentOption[]
    },
  })
  return { options: data ?? [], loading: isLoading, error: isError }
}
