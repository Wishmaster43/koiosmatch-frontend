/**
 * useWorkflowRunControl — regression test for the RUN-CONTROL-1 409 single-flight
 * path (extracted from useWorkflowEditor, split at ~400 lines, §3): starting a
 * run that is already running must point the viewer at the EXISTING run (not
 * fail silently), flag `runConflict`, and still open the run viewer — mirroring
 * a clean start. A genuine (non-409) failure must NOT do any of that.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { act } from 'react'
import { useWorkflowRunControl } from './useWorkflowRunControl'
import api from '@/lib/api'

vi.mock('@/lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
const mockedPost = vi.mocked(api.post)
const mockedGet  = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// Fresh QueryClient per render — no cross-test cache bleed, no retries slowing failures.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useWorkflowRunControl', () => {
  it('starts a run: sets activeRunId from the response and fires onRunStarted', async () => {
    mockedPost.mockResolvedValue({ data: { run: { id: 'r1' } } })
    mockedGet.mockResolvedValue({ data: { id: 'r1', status: 'running' } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(mockedPost).toHaveBeenCalledWith('/workflows/w1/run', undefined, { quietStatuses: [409] })
    expect(result.current.activeRunId).toBe('r1')
    expect(result.current.runConflict).toBe(false)
    expect(result.current.runError).toBeNull()
    expect(onRunStarted).toHaveBeenCalledTimes(1)
  })

  it('409 "already running": points activeRunId at the EXISTING run, flags runConflict, still opens the viewer', async () => {
    mockedPost.mockRejectedValue({ response: { status: 409, data: { message: 'loopt al', run_id: 'r-existing' } } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(result.current.activeRunId).toBe('r-existing')
    expect(result.current.runConflict).toBe(true)
    expect(result.current.runError).toBeNull()
    expect(result.current.running).toBe(false)
    expect(onRunStarted).toHaveBeenCalledTimes(1)
  })

  it('a non-409 failure surfaces the backend message and never sets runConflict', async () => {
    mockedPost.mockRejectedValue({ response: { status: 422, data: { message: 'Workflow is niet actief' } } })
    const onRunStarted = vi.fn()
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1', onRunStarted }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })

    expect(result.current.runError).toBe('Workflow is niet actief')
    expect(result.current.runConflict).toBe(false)
    expect(result.current.activeRunId).toBeNull()
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  it('handleStopped clears a prior conflict/error so the workflow can be re-run', async () => {
    mockedPost.mockRejectedValue({ response: { status: 409, data: { message: 'loopt al', run_id: 'r-existing' } } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })
    expect(result.current.runConflict).toBe(true)

    act(() => result.current.handleStopped())
    expect(result.current.runConflict).toBe(false)
    expect(result.current.runError).toBeNull()
  })

  it('waitFor: liveRunActive reflects a running/waiting poll result for the active run', async () => {
    mockedPost.mockResolvedValue({ data: { run: { id: 'r2' } } })
    mockedGet.mockResolvedValue({ data: { id: 'r2', status: 'waiting' } })
    const { result } = renderHook(
      () => useWorkflowRunControl({ workflowId: 'w1' }),
      { wrapper },
    )

    await act(async () => { await result.current.handleRun() })
    await waitFor(() => expect(result.current.liveRunActive).toBe(true))
  })
})
