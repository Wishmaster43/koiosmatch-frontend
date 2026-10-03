/**
 * useRunStepDetail/useRunStepListPage — SHARED-UNIT-TEST-1: asserts the
 * request route/params (§13), the 403-as-forbidden shape, and that the
 * list-page hook stays disabled without a `list` key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useRunStepDetail, useRunStepListPage } from './useRunStepDetail'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useRunStepDetail', () => {
  it('requests the per-step route and returns the data envelope', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: 'step-1', module_type: 'candidates_fetch' } } } as never)
    const { result } = renderHook(() => useRunStepDetail('run-1', 'step-1', true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/workflow-runs/run-1/steps/step-1', expect.objectContaining({ quietStatuses: [403] }))
    expect(result.current.step).toEqual({ id: 'step-1', module_type: 'candidates_fetch' })
  })

  it('stays disabled without a stepId', () => {
    renderHook(() => useRunStepDetail('run-1', undefined, true), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('reports a 403 as forbidden, not error', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } } as never)
    const { result } = renderHook(() => useRunStepDetail('run-1', 'step-1', true), { wrapper })
    await waitFor(() => expect(result.current.forbidden).toBe(true))
    expect(result.current.error).toBe(false)
  })
})

describe('useRunStepListPage', () => {
  it('requests the list key with page/per_page params', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { list: { key: 'candidates', data: [], meta: { current_page: 2, last_page: 3, per_page: 50, total: 120 } } },
    } as never)
    const { result } = renderHook(
      () => useRunStepListPage('run-1', 'step-1', { list: 'candidates', page: 2, per_page: 50 }), { wrapper },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/workflow-runs/run-1/steps/step-1', expect.objectContaining({
      params: { list: 'candidates', page: 2, per_page: 50 }, quietStatuses: [403, 422],
    }))
    expect(result.current.page?.meta.current_page).toBe(2)
  })

  it('stays disabled without a list key', () => {
    renderHook(() => useRunStepListPage('run-1', 'step-1', null), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })
})
