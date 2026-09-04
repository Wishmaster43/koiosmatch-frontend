/**
 * useWorkflowGraph — unit tests for the extracted graph-mutation hook (ARCH-01
 * split of useWorkflowEditor, §3). Covers the CONSENT-BEHOUD-1 edge-data
 * preservation rule (now centralised in workflowEditorUtils.mkEdgePreservingData)
 * across all three sites that re-link edges: router splice (onConnect), module
 * insert-on-edge (insertModule) and node delete-and-relink (deleteNode) — this
 * is the regression test the split's acceptance criteria call for.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Connection } from '@xyflow/react'
import { useWorkflowGraph } from './useWorkflowGraph'
import type { Workflow, WorkflowStep } from '@/types/workflow'

const wf = (steps: WorkflowStep[]): Workflow =>
  ({ id: 'w1', name: 'wf', trigger: 'Manual', status: 'draft', steps })

const conn = (source: string, target: string): Connection => ({ source, target, sourceHandle: null, targetHandle: null })

// A fixed, recognisable filter payload — asserted to survive every re-link.
const CONSENT_FILTERS = { conditions: [{ field: 'whatsapp_consent', operator: '=', value: 'true' }], logic: 'AND' as const }

describe('useWorkflowGraph · CONSENT-BEHOUD-1 (edge data survives every re-link)', () => {
  it('router splice (onConnect on an already-targeted node) keeps the existing incoming edge data', async () => {
    const { result } = renderHook(() => useWorkflowGraph({
      workflow: wf([
        { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
        { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
      ]),
    }))
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    act(() => result.current.saveEdgeFilter(result.current.edges[0].id, CONSENT_FILTERS, 'Consent'))
    expect(result.current.edges[0].data?.filters).toEqual(CONSENT_FILTERS)

    // A second source connects to n2, which already has an incoming edge — a router splices in.
    act(() => result.current.onConnect(conn('n3', 'n2')))
    const relinked = result.current.edges.find(e => e.target !== 'n2' && e.data?.filters)
    expect(relinked?.data?.filters).toEqual(CONSENT_FILTERS)
  })

  it('insertModule on an edge keeps that edge data on the upstream half of the split', async () => {
    const { result } = renderHook(() => useWorkflowGraph({
      workflow: wf([
        { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
        { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
      ]),
    }))
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    const edgeId = result.current.edges[0].id
    act(() => result.current.saveEdgeFilter(edgeId, CONSENT_FILTERS, 'Consent'))

    act(() => result.current.insertModule('whatsapp', edgeId))
    const upstreamHalf = result.current.edges.find(e => e.source === 'n1')
    expect(upstreamHalf?.data?.filters).toEqual(CONSENT_FILTERS)
  })

  it('deleteNode re-links around the removed node and keeps the incoming edge data', async () => {
    const { result } = renderHook(() => useWorkflowGraph({
      workflow: wf([
        { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
        { id: 'n2', type: 'router', config: {}, position: { x: 220, y: 180 }, next: [{ target: 'n3' }] },
        { id: 'n3', type: 'email', config: {}, position: { x: 440, y: 180 } },
      ]),
    }))
    await waitFor(() => expect(result.current.edges).toHaveLength(2))
    const inEdgeId = result.current.edges.find(e => e.target === 'n2')!.id
    act(() => result.current.saveEdgeFilter(inEdgeId, CONSENT_FILTERS, 'Consent'))

    act(() => result.current.deleteNode('n2'))
    expect(result.current.edges).toHaveLength(1)
    expect(result.current.edges[0]).toMatchObject({ source: 'n1', target: 'n3' })
    expect(result.current.edges[0].data?.filters).toEqual(CONSENT_FILTERS)
  })
})

describe('useWorkflowGraph · start-node resolution', () => {
  it('firstNodeId defaults to the leftmost node without an incoming edge, overridable via setStartNodeId', async () => {
    const { result } = renderHook(() => useWorkflowGraph({
      workflow: wf([
        { id: 'n1', type: 'candidates', config: {}, position: { x: 0, y: 180 }, next: [{ target: 'n2' }] },
        { id: 'n2', type: 'email', config: {}, position: { x: 220, y: 180 } },
      ]),
    }))
    await waitFor(() => expect(result.current.edges).toHaveLength(1))
    expect(result.current.firstNodeId).toBe('n1')
    act(() => result.current.setStartNodeId('n2'))
    expect(result.current.firstNodeId).toBe('n2')
  })
})
