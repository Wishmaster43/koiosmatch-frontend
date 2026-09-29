import { describe, it, expect } from 'vitest'
import { resolveEffectiveInterviewWorkflow } from './interviewWorkflowEffective'

const OWN = { id: 'wf-app', name: 'App workflow', agent: { id: 'a-app', name: 'App agent' } }
const VAC = { id: 'wf-vac', name: 'Vacancy workflow', agent: { id: 'a-vac', name: 'Vacancy agent' } }

describe('resolveEffectiveInterviewWorkflow (pure)', () => {
  it('prefers the application own workflow over the vacancy default', () => {
    expect(resolveEffectiveInterviewWorkflow(OWN, VAC)).toEqual({
      workflowName: 'App workflow', agentId: 'a-app', agentName: 'App agent', source: 'application',
    })
  })

  it('falls back to the vacancy default when the application has none of its own', () => {
    expect(resolveEffectiveInterviewWorkflow(null, VAC)).toEqual({
      workflowName: 'Vacancy workflow', agentId: 'a-vac', agentName: 'Vacancy agent', source: 'vacancy',
    })
  })

  it('returns null when neither exists — the manual agent picker stays the only path', () => {
    expect(resolveEffectiveInterviewWorkflow(null, null)).toBeNull()
    expect(resolveEffectiveInterviewWorkflow(undefined, undefined)).toBeNull()
  })

  it('resolves a null agent id honestly rather than fabricating one', () => {
    const noAgent = { id: 'wf-x', name: 'No agent workflow', agent: null }
    expect(resolveEffectiveInterviewWorkflow(noAgent, null)).toEqual({
      workflowName: 'No agent workflow', agentId: null, agentName: '', source: 'application',
    })
  })
})
