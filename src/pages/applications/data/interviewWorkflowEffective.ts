/**
 * interviewWorkflowEffective — INTERVIEW-VISIBILITY-1 (Danny 29-09: "als de workflow
 * gekozen is, is het losse AI-agent-veld niet meer nodig"). Resolves the ONE
 * interview workflow actually in effect for an application: its own override
 * first, then the vacancy's default — never both, never a picker on top. Pure so
 * both the Start card and the override caption read the identical resolution.
 */
import type { InterviewWorkflowRef } from '@/types/vacancy'
import type { Id } from '@/types/common'

export interface EffectiveInterviewWorkflow {
  workflowName: string
  agentId: Id | null
  agentName: string
  // Which level supplied it — drives the "Standaard van vacature" vs the plain
  // "Start via …" caption without a second lookup at the call site.
  source: 'application' | 'vacancy'
}

// Application override wins; the vacancy default is the fallback; null means no
// workflow is in effect at all (today's manual agent picker stays the only path).
export function resolveEffectiveInterviewWorkflow(
  ownWorkflow: InterviewWorkflowRef | null | undefined,
  vacancyWorkflow: InterviewWorkflowRef | null | undefined,
): EffectiveInterviewWorkflow | null {
  if (ownWorkflow) {
    return { workflowName: ownWorkflow.name ?? '', agentId: ownWorkflow.agent?.id ?? null, agentName: ownWorkflow.agent?.name ?? '', source: 'application' }
  }
  if (vacancyWorkflow) {
    return { workflowName: vacancyWorkflow.name ?? '', agentId: vacancyWorkflow.agent?.id ?? null, agentName: vacancyWorkflow.agent?.name ?? '', source: 'vacancy' }
  }
  return null
}
