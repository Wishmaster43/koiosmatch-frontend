/**
 * useInterviewOptions — INTERVIEW-PICKER-AUTHZ-FE: the narrow `applications.update`
 * -gated picker source (option A), mirroring useInterviewWorkflows.test.ts's
 * QueryClient wrapper + mock recipe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useInterviewOptions } from './useInterviewOptions'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const payload = {
  workflows: [{ id: 'wf-1', name: 'Kelly-Helpende', agent: { id: 'ag-1', name: 'Kelly' } }],
  agents: [{ id: 'ag-1', name: 'Kelly' }, { id: 'ag-2', name: 'Sam' }],
}

beforeEach(() => vi.clearAllMocks())

describe('useInterviewOptions · the narrow interview-options endpoint', () => {
  it('maps workflows and agents to picker options', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: payload } as never)
    const { result } = renderHook(() => useInterviewOptions(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.workflowOptions).toEqual([{ value: 'wf-1', label: 'Kelly-Helpende' }])
    expect(result.current.agentOptions).toEqual([{ value: 'ag-1', label: 'Kelly' }, { value: 'ag-2', label: 'Sam' }])
    expect(api.get).toHaveBeenCalledWith('/applications/interview-options', expect.objectContaining({ quietStatuses: [403] }))
  })

  it('describeWorkflow resolves a linked id from the list, as never-inactive', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: payload } as never)
    const { result } = renderHook(() => useInterviewOptions(true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.describeWorkflow('wf-1')).toEqual({ label: 'Kelly-Helpende', inactive: false })
    expect(result.current.describeWorkflow('wf-does-not-exist')).toBeNull()
    expect(result.current.describeWorkflow(null)).toBeNull()
  })

  // INTERVIEW-403-1: a 403 is a role answer, reported as `forbidden`, never `error`.
  it('reports a 403 as forbidden (not error) with empty options', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } } as never)
    const { result } = renderHook(() => useInterviewOptions(true), { wrapper })
    await waitFor(() => expect(result.current.forbidden).toBe(true))
    expect(result.current.error).toBe(false)
    expect(result.current.workflowOptions).toEqual([])
    expect(result.current.agentOptions).toEqual([])
  })
})
