/**
 * useVacancyAgentDefault — punt 20: proposes the AI agent LINKED TO THE VACANCY
 * OWNER (agent.user.id === ownerId) into the create form's `aiAgentId`. Mirrors
 * useVacancyBranchDefault's propose-but-freeze-on-edit idiom (VAC-VESTIGING-1):
 * the proposal recomputes on every owner switch until the recruiter edits the
 * agent field by hand (including the clear-X), then `agentDirty` freezes it for
 * the rest of the create session. This is a DERIVATION, not explicit context
 * (§0/KOIOS-VOORSTEL-1), so the caller shows the KoiosSuggestionBadge while the
 * current value still equals this proposal — never a silent guess.
 */
import { useState, useEffect } from 'react'
import type { AiAgent } from '@/types/ai'
import type { Id } from '@/types/common'

export function useVacancyAgentDefault(ownerId: string, agents: AiAgent[], setAiAgentId: (v: string) => void) {
  const [agentDirty, setAgentDirty] = useState(false)
  // Empty when the owner has no linked agent — never a fallback guess (§0).
  const ownerAgent = ownerId ? agents.find(a => a.user?.id != null && String(a.user.id) === String(ownerId)) : undefined
  const suggestedAgentId: Id | '' = ownerAgent?.id ?? ''

  // Re-propose the owner's linked agent on every owner switch, but only while
  // the recruiter has not touched the agent field by hand.
  useEffect(() => {
    if (agentDirty) return
    setAiAgentId(suggestedAgentId ? String(suggestedAgentId) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-propose on the resolved suggestion / dirty flag, never on setAiAgentId's identity
  }, [suggestedAgentId, agentDirty])

  // A manual pick (including the clear-X) freezes the proposal for the rest of this create session.
  const handleAiAgentChange = (v: string) => { setAgentDirty(true); setAiAgentId(v) }

  // The badge shows only while the current value still IS the live proposal (never after a manual pick/clear).
  const showAgentSuggestion = !agentDirty && !!suggestedAgentId

  return { handleAiAgentChange, showAgentSuggestion }
}
