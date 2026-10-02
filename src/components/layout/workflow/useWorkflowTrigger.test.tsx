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

// INTERVIEW-FLAG-1: the maker-set flag seeds from workflow.is_interview, travels
// in the save payload and participates in the dirty-check.
describe('useWorkflowTrigger · isInterview (INTERVIEW-FLAG-1)', () => {
  it('seeds from workflow.is_interview, defaulting to false', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf(), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))
    expect(result.current.isInterview).toBe(false)
  })

  it('toggling isInterview flips the save payload and rises the dirty flag', () => {
    const onSave = vi.fn()
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf({ is_interview: false }), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))
    expect(result.current.isDirty()).toBe(false)
    act(() => result.current.setIsInterview(true))
    expect(result.current.isDirty()).toBe(true)
    act(() => result.current.handleSave())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ is_interview: true }), false)
    expect(result.current.isDirty()).toBe(false)
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

// ONIX N-007: two synchronous Save clicks while the first save is still in
// flight must call onSave once — the second is dropped, not queued.
describe('useWorkflowTrigger · handleSave re-entrancy latch (ONIX N-007)', () => {
  it('two synchronous handleSave() calls with a pending async onSave call onSave once', async () => {
    let resolve!: (v: boolean) => void
    const onSave = vi.fn(() => new Promise<boolean>(r => { resolve = r }))
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf(), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))

    let second: boolean | Promise<boolean> = true
    act(() => {
      result.current.handleSave()
      second = result.current.handleSave()
    })
    expect(second).toBe(false)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(result.current.saving).toBe(true)

    await act(async () => { resolve(true) })
    expect(result.current.saving).toBe(false)
  })

  // Verifier fix: a rejected onSave must release the latch too (it used to stick
  // forever, leaving Save/Save&close disabled and every later handleSave a no-op).
  it('a rejected onSave releases the latch so saving goes back to false and a second handleSave calls onSave again', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('network error')))
    const { result } = renderHook(() => useWorkflowTrigger({ workflow: wf(), nodes, edges, initialNodes: nodes, initialEdges: edges, onSave }))

    let first!: Promise<boolean>
    await act(async () => {
      first = result.current.handleSave() as Promise<boolean>
    })
    expect(await first).toBe(false)
    expect(result.current.saving).toBe(false)

    await act(async () => { result.current.handleSave() })
    expect(onSave).toHaveBeenCalledTimes(2)
  })
})
