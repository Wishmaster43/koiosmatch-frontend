/**
 * useWorkflowTrigger — unit tests for the extracted trigger/save/dirty-check
 * hook (ARCH-01 split of useWorkflowEditor, §3): handleSave's denormalized
 * trigger_config per trigger type, and the isDirty baseline round-trip.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkflowTrigger } from './useWorkflowTrigger'
import type { Workflow, FlowNode, FlowEdge } from '@/types/workflow'

const wf = (overrides: Partial<Workflow> = {}): Workflow =>
  ({ id: 'w1', name: 'My workflow', trigger: 'Manual', status: 'draft', steps: [], ...overrides })

const nodes: FlowNode[] = [
  { id: 'n1', type: 'module', position: { x: 0, y: 0 }, data: { type: 'candidates', config: {} } },
]
const edges: FlowEdge[] = []
// initialNodes/initialEdges seed the dirty-check baseline; live nodes/edges below
// are the SAME reference in these tests since useWorkflowTrigger itself never
// defers edges (that live-vs-initial gap only exists in the composer via
// useWorkflowGraph's mount effect — covered separately in useWorkflowEditor.test.tsx).

describe('useWorkflowTrigger · handleSave payload (denormalized per trigger)', () => {
  it('Scheduled trigger: handleSave writes the flat scheduleConfig onto trigger_config, no wrapper', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf({ trigger: 'Scheduled' }), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))
    act(() => result.current.setScheduleConfig({ frequency: 'weekly' }))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'Scheduled', trigger_config: { frequency: 'weekly' } }),
      false,
    )
  })

  it('Webhook trigger: handleSave(true) passes closeAfter through and sets trigger_config.webhook_id', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useWorkflowTrigger({
      workflow: wf({ trigger: 'Webhook', trigger_config: { webhook_id: 'wh1' } }), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave,
    }))
    act(() => result.current.handleSave(true))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'Webhook', trigger_config: { webhook_id: 'wh1' } }),
      true,
    )
  })
})

describe('useWorkflowTrigger · isDirty (dirty-check baseline)', () => {
  it('is clean on load, dirty after a field change, clean again after handleSave', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf(), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))
    expect(result.current.isDirty()).toBe(false)
    act(() => result.current.setName('Renamed'))
    expect(result.current.isDirty()).toBe(true)
    act(() => result.current.handleSave())
    expect(result.current.isDirty()).toBe(false)
  })
})
