/**
 * useMatchAgentSessions — the match's interview sessions via the application
 * (if linked) or the candidate (if direct match). GET /matches/{id}/agent-sessions
 * returns the same session blocks as ApplicationInterview (via mapInterview),
 * plus the conversation_id for each block's pause/resume control.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import { mapInterview } from '@/pages/applications/shared'
import type { ApplicationInterview, ApiApplication } from '@/types/application'
import type { Id } from '@/types/common'

type SessionBlock = ApiApplication['interview'] & { conversation_id?: Id | null }

interface MappedSession {
  interview: ApplicationInterview | null
  conversationId: Id | null
}

interface UseMatchAgentSessionsResult {
  sessions: MappedSession[]
  loading: boolean
  error: unknown
  empty: boolean
  refetch: () => void
}

// Fetch the match's interview sessions (from application or candidate).
export function useMatchAgentSessions(matchId: Id | null | undefined): UseMatchAgentSessionsResult {
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['matches', matchId, 'agent-sessions'],
    queryFn: async () => {
      if (!matchId) return []
      const res = await api.get(`/matches/${matchId}/agent-sessions`)
      const { rows: blocks } = unwrapList<SessionBlock>(res)
      return blocks
    },
    enabled: !!matchId,
  })

  const sessions: MappedSession[] = rows.map(block => ({
    interview: mapInterview(block),
    conversationId: block.conversation_id ?? null,
  }))

  return {
    sessions,
    loading: isLoading,
    error: isError ? error : null,
    empty: sessions.length === 0,
    refetch: () => void refetch(),
  }
}
