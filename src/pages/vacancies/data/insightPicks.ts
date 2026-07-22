/**
 * Insight-donut click resolvers (VAC-KPI-REDESIGN 22-07) — small pure functions so
 * the new funnel/agent donut click-targets are unit-testable without rendering the
 * full VacanciesPage (VacancyLookupsProvider, RightPanelContext, AuthContext, the
 * users query, …). Mirrors how pickKey/resolveStatusSegment already live as pure,
 * tested helpers in vacanciesShared.ts, extracted from the same page.
 */
import { pickKey } from './vacanciesShared'

// Funnel donut segment click → the phase key to open Applications with (or
// undefined for an unclickable/empty segment — the caller then skips navigating).
export function pickFunnelPhase(d: unknown): string | undefined {
  return pickKey(d)
}

// AI-agent donut segment click → the next agent-filter state. '__none' is the
// dedicated "Geen agent" bucket (→ ?without_agent=1, toggling); any other key is a
// real agent id (→ ?agent_id=<id>), clicking the SAME agent again clears it. The
// two filters are mutually exclusive — picking one always clears the other.
export interface AgentPickResult { selectedAgentId: string | null; showWithoutAgent: boolean }
export function pickAgentSegment(d: unknown, currentAgentId: string | null, currentWithoutAgent: boolean): AgentPickResult {
  const k = pickKey(d)
  if (k === '__none') return { selectedAgentId: null, showWithoutAgent: !currentWithoutAgent }
  if (k == null) return { selectedAgentId: currentAgentId, showWithoutAgent: currentWithoutAgent }
  return { selectedAgentId: currentAgentId === k ? null : k, showWithoutAgent: false }
}
