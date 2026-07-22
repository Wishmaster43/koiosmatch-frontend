import { describe, it, expect } from 'vitest'
import { pickFunnelPhase, pickAgentSegment } from './insightPicks'

describe('pickFunnelPhase (VAC-KPI-REDESIGN) — the funnel donut click-target', () => {
  it('resolves the phase key from a recharts click payload', () => {
    expect(pickFunnelPhase({ key: 'invited' })).toBe('invited')
  })

  it('also resolves a key nested under .payload (recharts sometimes nests it there)', () => {
    expect(pickFunnelPhase({ payload: { key: 'hired' } })).toBe('hired')
  })

  it('falls back to name when no key is present, and is undefined for an empty click', () => {
    expect(pickFunnelPhase({ name: 'Aangenomen' })).toBe('Aangenomen')
    expect(pickFunnelPhase({})).toBeUndefined()
  })
})

describe('pickAgentSegment (VAC-KPI-REDESIGN) — the AI-agent donut click-target', () => {
  it('a real agent id sets agent_id and clears without_agent', () => {
    expect(pickAgentSegment({ key: 'agent1' }, null, true)).toEqual({ selectedAgentId: 'agent1', showWithoutAgent: false })
  })

  it('clicking the SAME agent again clears the filter (toggle off)', () => {
    expect(pickAgentSegment({ key: 'agent1' }, 'agent1', false)).toEqual({ selectedAgentId: null, showWithoutAgent: false })
  })

  it('clicking a different agent replaces the selection', () => {
    expect(pickAgentSegment({ key: 'agent2' }, 'agent1', false)).toEqual({ selectedAgentId: 'agent2', showWithoutAgent: false })
  })

  it('the "Geen agent" bucket (__none) toggles without_agent and clears any picked agent', () => {
    expect(pickAgentSegment({ key: '__none' }, 'agent1', false)).toEqual({ selectedAgentId: null, showWithoutAgent: true })
    expect(pickAgentSegment({ key: '__none' }, null, true)).toEqual({ selectedAgentId: null, showWithoutAgent: false })
  })

  it('an empty click (no key) is a no-op — current state passes through unchanged', () => {
    expect(pickAgentSegment({}, 'agent1', false)).toEqual({ selectedAgentId: 'agent1', showWithoutAgent: false })
  })
})
