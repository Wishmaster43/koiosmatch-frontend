import { describe, it, expect } from 'vitest'
import { seedOutputsFromSteps } from './useOutputSeeding'
import type { FlowNode } from '@/types/workflow'
import type { RunStep } from '@/types/reports'

// Minimal node fixture — only `id` and `data.output` matter to seedOutputsFromSteps.
function makeNode(id: string, output: unknown = null): FlowNode {
  return { id, type: 'module', position: { x: 0, y: 0 }, data: { type: 'candidates', config: {}, output } }
}

describe('seedOutputsFromSteps', () => {
  it('copies a step output onto the node with the matching (stable) id', () => {
    const nodes = [makeNode('n1'), makeNode('n2')]
    const steps: RunStep[] = [
      { step_id: 'n1', output: { id: 1, name: 'Mark' } },
      { step_id: 'n2', output: { id: 2, name: 'Sanne' } },
    ]
    const result = seedOutputsFromSteps(nodes, steps)
    expect(result[0].data.output).toEqual({ id: 1, name: 'Mark' })
    expect(result[1].data.output).toEqual({ id: 2, name: 'Sanne' })
  })

  it('matches a numeric step_id against a string node id (loose id equality)', () => {
    const nodes = [makeNode('7')]
    const steps: RunStep[] = [{ step_id: 7, output: { ok: true } }]
    expect(seedOutputsFromSteps(nodes, steps)[0].data.output).toEqual({ ok: true })
  })

  it('leaves a node unchanged when no step matches its id', () => {
    const nodes = [makeNode('n1', { stale: true })]
    const steps: RunStep[] = [{ step_id: 'other', output: { fresh: true } }]
    expect(seedOutputsFromSteps(nodes, steps)[0].data.output).toEqual({ stale: true })
  })

  it('leaves a node unchanged when the matching step carries no output', () => {
    const nodes = [makeNode('n1', { stale: true })]
    const steps: RunStep[] = [{ step_id: 'n1', status: 'success' }]
    expect(seedOutputsFromSteps(nodes, steps)[0].data.output).toEqual({ stale: true })
  })

  it('is a no-op for an empty steps array', () => {
    const nodes = [makeNode('n1', { kept: true })]
    expect(seedOutputsFromSteps(nodes, [])).toBe(nodes)
  })
})
