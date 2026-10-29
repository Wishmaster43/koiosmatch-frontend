/**
 * useSmEmployeeAiOptOut — asserts the exact PATCH (route + body, §13), the
 * optimistic value, and the rollback + toast on a rejected request (SHARED-UNIT-TEST-1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useSmEmployeeAiOptOut } from './useSmEmployeeAiOptOut'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { ...(actual as { default: object }).default, patch: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('useSmEmployeeAiOptOut', () => {
  afterEach(() => vi.clearAllMocks())

  it('PATCHes /sm_candidates/7 with { ai_enabled: false } and keeps the reconciled value', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { data: { ai_enabled: false } } })
    const { result } = renderHook(() => useSmEmployeeAiOptOut('7', true, 'failed'), { wrapper })
    await act(async () => { await result.current.setEnabled(false) })
    expect(api.patch).toHaveBeenCalledWith('/sm_candidates/7', { ai_enabled: false })
    expect(result.current.enabled).toBe(false)
  })

  it('rolls back to the previous value and toasts on a rejected request', async () => {
    vi.mocked(api.patch).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useSmEmployeeAiOptOut('7', true, 'failed'), { wrapper })
    await act(async () => { await result.current.setEnabled(false) })
    expect(result.current.enabled).toBe(true)
    expect(notifyError).toHaveBeenCalledWith('failed')
  })

  it('sends nothing without an id', async () => {
    const { result } = renderHook(() => useSmEmployeeAiOptOut(undefined, undefined, 'failed'), { wrapper })
    await act(async () => { await result.current.setEnabled(true) })
    expect(api.patch).not.toHaveBeenCalled()
  })
})
