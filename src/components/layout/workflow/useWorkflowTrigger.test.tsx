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

// WFB-02/03/05 (09-09): a workflow reloaded from the API re-saves its header trigger
// config WHOLE — a DateRelative kept only its word (config wiped to nulls), an Event
// lost its seeded `conditions`, an agent webhook its `source` lane.
describe('useWorkflowTrigger · reload + immediate re-save is lossless', () => {
  it('DateRelative: date_field + offset_days survive a save without reopening the modal', () => {
    const onSave = vi.fn()
    const cfg = { date_field: 'match.end_date', offset_days: -28 }
    const { result } = renderHook(() => useWorkflowTrigger({
      workflow: wf({ trigger: 'DateRelative', trigger_config: cfg }), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave,
    }))
    expect(result.current.isDirty()).toBe(false)
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'DateRelative', trigger_config: cfg }), false)
  })

  it('Event: seeded conditions ride along on re-save', () => {
    const onSave = vi.fn()
    const cfg = { event: 'mail.received', conditions: { source: 'sdb', type: 'beschikbaar' } }
    const { result } = renderHook(() => useWorkflowTrigger({
      workflow: wf({ trigger: 'Event', trigger_config: cfg }), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave,
    }))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger_config: cfg }), false)
  })

  it('Webhook (agent flavor): the source lane rides along on re-save', () => {
    const onSave = vi.fn()
    const cfg = { agent: 'Michelle', source: 'wa_web' }
    const { result } = renderHook(() => useWorkflowTrigger({
      workflow: wf({ trigger: 'Webhook', trigger_config: cfg }), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave,
    }))
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trigger_config: cfg }), false)
  })
})

// RUN-SAVES-FIRST-1 (Danny 10-09): a refused save leaves the editor dirty and the
// server status untouched; a resolved save moves the server status along.
describe('useWorkflowTrigger · handleSave reports success (RUN-SAVES-FIRST-1)', () => {
  it('a synchronous onSave that returns false keeps the editor dirty and the server status as loaded', () => {
    const onSave = vi.fn(() => false)
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf(), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))
    act(() => result.current.setStatus('active'))
    let ok: boolean | Promise<boolean> = true
    act(() => { ok = result.current.handleSave() })
    expect(ok).toBe(false)
    expect(result.current.isDirty()).toBe(true)
    expect(result.current.serverStatus).toBe('draft')
    expect(result.current.status).toBe('active')
  })

  it('an async onSave that resolves moves the server status to the saved one and clears the dirty flag', async () => {
    const onSave = vi.fn(async () => true)
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf(), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))
    act(() => result.current.setStatus('active'))
    expect(result.current.serverStatus).toBe('draft')
    let ok: boolean | Promise<boolean> = false
    await act(async () => { ok = await result.current.handleSave() })
    expect(ok).toBe(true)
    expect(result.current.serverStatus).toBe('active')
    expect(result.current.isDirty()).toBe(false)
  })
})
