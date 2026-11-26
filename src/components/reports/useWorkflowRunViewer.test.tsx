/**
 * useWorkflowRunViewer: the run fetch by id, the toast on failure and the close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWorkflowRunViewer } from './useWorkflowRunViewer'
import { fetchWorkflowRun } from '@/components/ui/richtext/assistActionsExecuteApi'
import { notifyError } from '@/lib/notify'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/notify', () => ({ notifyError: vi.fn() }))
vi.mock('@/components/ui/richtext/assistActionsExecuteApi', () => ({ fetchWorkflowRun: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('useWorkflowRunViewer', () => {
  it('fetches the run by id and holds it; closeRun drops it', async () => {
    vi.mocked(fetchWorkflowRun).mockResolvedValueOnce({ id: 'r1' } as never)
    const { result } = renderHook(() => useWorkflowRunViewer())
    expect(result.current.viewingRun).toBeNull()
    await act(async () => { await result.current.viewRun('r1') })
    expect(fetchWorkflowRun).toHaveBeenCalledWith('r1')
    expect(result.current.viewingRun).toEqual({ id: 'r1' })
    expect(result.current.runLoading).toBe(false)
    act(() => { result.current.closeRun() })
    expect(result.current.viewingRun).toBeNull()
  })

  it('a failed fetch toasts the generic error and keeps the drawer closed', async () => {
    vi.mocked(fetchWorkflowRun).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useWorkflowRunViewer())
    await act(async () => { await result.current.viewRun('r2') })
    expect(notifyError).toHaveBeenCalledWith('common:errorGeneric')
    expect(result.current.viewingRun).toBeNull()
    expect(result.current.runLoading).toBe(false)
  })
})
