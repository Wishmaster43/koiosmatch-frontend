/**
 * useWorkflowPanels — unit tests for the extracted panel-visibility hook
 * (ARCH-01 split of useWorkflowEditor, §3): picker/filter/output targeting,
 * schedule/logs/wide-panel toggles, and the two edge-click openers.
 */
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkflowPanels } from './useWorkflowPanels'

describe('useWorkflowPanels', () => {
  it('defaults everything closed, unless an initialRunId is given (opens the logs panel)', () => {
    const { result } = renderHook(() => useWorkflowPanels())
    expect(result.current.showLogs).toBe(false)
    const withRun = renderHook(() => useWorkflowPanels({ initialRunId: 'r1' }))
    expect(withRun.result.current.showLogs).toBe(true)
  })

  it('handleEdgeAdd / handleEdgeFilter open the picker/filter panel scoped to that edge', () => {
    const { result } = renderHook(() => useWorkflowPanels())
    act(() => result.current.handleEdgeAdd('e1'))
    expect(result.current.pickerState).toEqual({ edgeId: 'e1' })
    act(() => result.current.handleEdgeFilter('e1'))
    expect(result.current.filterState).toEqual({ edgeId: 'e1' })
  })

  it('openLogsOnRun opens the logs panel', () => {
    const { result } = renderHook(() => useWorkflowPanels())
    act(() => result.current.openLogsOnRun())
    expect(result.current.showLogs).toBe(true)
  })

  it('outputState/showSchedule/widePanelActive toggle independently via their setters', () => {
    const { result } = renderHook(() => useWorkflowPanels())
    act(() => result.current.setOutputState({ nodeId: 'n1', output: { ok: true } }))
    expect(result.current.outputState).toEqual({ nodeId: 'n1', output: { ok: true } })
    act(() => result.current.setShowSchedule(true))
    expect(result.current.showSchedule).toBe(true)
    act(() => result.current.setWidePanelActive(true))
    expect(result.current.widePanelActive).toBe(true)
  })
})
