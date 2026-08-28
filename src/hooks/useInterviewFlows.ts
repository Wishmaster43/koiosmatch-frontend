/**
 * useInterviewFlows — the tenant's AI interview-flow list (GET /ai/interview-flows),
 * shared by every entity that offers a flow picker (the vacancy default binding,
 * VAC-AGENT-1's flow-picker follow-up, and the application-level override on
 * InterviewStatusCard). Mirrors useAiAgents' shape/caching so both pickers behave
 * identically (§3A consistency).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

// The list contract's own shape (GET /ai/interview-flows → {data:[{id,name,channel,active}]}).
export interface InterviewFlowOption { id: Id; name: string; channel?: string; active?: boolean }

const NO_FLOWS: InterviewFlowOption[] = []

// The tenant's interview-flow picker options + the raw list, one cached react-query entry shared across every consumer.
export function useInterviewFlows(enabled: boolean = true) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-interview-flows'],
    enabled,
    queryFn: async ({ signal }) => {
      const { rows } = unwrapList<InterviewFlowOption>(await api.get('/ai/interview-flows', { signal }))
      return rows
    },
  })
  const flows = data ?? NO_FLOWS
  // ACTIVE flows only (r2 C1): the engine treats an inactive bound flow as a
  // HARD skip — it never falls through to the agent (InterviewEngine:93), so
  // offering inactive flows silently switched interviews OFF for that record.
  const options = useMemo(() => flows.filter(f => f.active !== false).map(f => ({ value: String(f.id ?? ''), label: f.name ?? '' })), [flows])
  // For a value bound BEFORE its flow went inactive: resolve its label + state
  // so the picker can show the truth instead of an unexplained empty field.
  const describe = (id?: Id | null) => {
    if (id == null || id === '') return null
    const f = flows.find(x => String(x.id) === String(id))
    return f ? { label: f.name ?? String(id), inactive: f.active === false } : null
  }
  return { options, flows, describe, loading: isLoading, error: isError }
}
