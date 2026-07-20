/**
 * computeWorkflowSnapshot — the dirty-check serializer (item 19): the workflow
 * builder's close (X) button confirms before discarding unsaved changes, derived
 * cheaply by comparing this snapshot against the last-saved baseline.
 */
import { describe, it, expect } from 'vitest'
import { computeWorkflowSnapshot } from './useWorkflowEditor'
import type { FlowNode, FlowEdge } from '@/types/workflow'

const node = (id: string, type = 'candidates'): FlowNode =>
  ({ id, type: 'module', position: { x: 0, y: 0 }, width: 90, height: 110, data: { type, config: {} } })

describe('computeWorkflowSnapshot', () => {
  it('is deterministic for the same graph/name/trigger/status', () => {
    const nodes: FlowNode[] = [node('a')]
    const edges: FlowEdge[] = []
    const s1 = computeWorkflowSnapshot(nodes, edges, 'My workflow', 'Manual', null, null, 'draft')
    const s2 = computeWorkflowSnapshot(nodes, edges, 'My workflow', 'Manual', null, null, 'draft')
    expect(s1).toBe(s2)
  })

  it('changes when the name changes', () => {
    const nodes: FlowNode[] = [node('a')]
    const base = computeWorkflowSnapshot(nodes, [], 'My workflow', 'Manual', null, null, 'draft')
    const renamed = computeWorkflowSnapshot(nodes, [], 'Renamed', 'Manual', null, null, 'draft')
    expect(renamed).not.toBe(base)
  })

  it('changes when a node is added or removed', () => {
    const one = computeWorkflowSnapshot([node('a')], [], 'wf', 'Manual', null, null, 'draft')
    const two = computeWorkflowSnapshot([node('a'), node('b')], [], 'wf', 'Manual', null, null, 'draft')
    expect(two).not.toBe(one)
  })

  it('changes when status flips (draft <-> active)', () => {
    const nodes: FlowNode[] = [node('a')]
    const draft  = computeWorkflowSnapshot(nodes, [], 'wf', 'Manual', null, null, 'draft')
    const active = computeWorkflowSnapshot(nodes, [], 'wf', 'Manual', null, null, 'active')
    expect(active).not.toBe(draft)
  })

  it('changes when the schedule config changes on a Scheduled trigger', () => {
    const nodes: FlowNode[] = [node('a')]
    const daily   = computeWorkflowSnapshot(nodes, [], 'wf', 'Scheduled', { time: '08:00' } as never, null, 'draft')
    const evening = computeWorkflowSnapshot(nodes, [], 'wf', 'Scheduled', { time: '20:00' } as never, null, 'draft')
    expect(evening).not.toBe(daily)
  })

  it('ignores the schedule config when the trigger is not Scheduled (no false dirty)', () => {
    const nodes: FlowNode[] = [node('a')]
    const a = computeWorkflowSnapshot(nodes, [], 'wf', 'Manual', { time: '08:00' } as never, null, 'draft')
    const b = computeWorkflowSnapshot(nodes, [], 'wf', 'Manual', { time: '20:00' } as never, null, 'draft')
    expect(a).toBe(b)
  })

  // BIRTHDAY-FLOW-2: an Event trigger's event key participates in the dirty-check
  // exactly like a Scheduled trigger's schedule config does.
  it('changes when the event key changes on an Event trigger', () => {
    const nodes: FlowNode[] = [node('a')]
    const birthday = computeWorkflowSnapshot(nodes, [], 'wf', 'Event', { event: 'candidate.birthday' } as never, null, 'draft')
    const other    = computeWorkflowSnapshot(nodes, [], 'wf', 'Event', { event: 'match.created' } as never, null, 'draft')
    expect(other).not.toBe(birthday)
  })
})
