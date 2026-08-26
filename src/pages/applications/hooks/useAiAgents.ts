/**
 * useAiAgents — thin re-export of the shared hook (src/hooks/useAiAgents.ts).
 * Kept as its own file so existing imports (`'../hooks/useAiAgents'` from
 * InterviewsTab, INTERVIEW-PERAPP-1 Flow B) keep resolving unchanged; the vacancy
 * feature's own copy re-exports the exact same implementation.
 */
export { useAiAgents } from '@/hooks/useAiAgents'
export type { AiAgentOption, UseAiAgentsResult } from '@/hooks/useAiAgents'
