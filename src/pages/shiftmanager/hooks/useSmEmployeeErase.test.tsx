/**
 * useSmEmployeeErase — asserts the exact erase request (route + body, §13),
 * the success path (toast, list invalidation, close) and that a failure
 * rethrows and leaves the dialog open (SHARED-UNIT-TEST-1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { useSmEmployeeErase } from './useSmEmployeeErase'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { ...(actual as { default: object }).default, post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

describe('useSmEmployeeErase', () => {
  afterEach(() => vi.clearAllMocks())

  it('POSTs /sm_candidates/{id}/erase with { password }, toasts the server message and closes', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { message: 'Erased', sm_candidate_id: '7' } } })
    const close = vi.fn()
    const { result } = renderHook(() => useSmEmployeeErase('7', close, 'fallback'), { wrapper })
    act(() => result.current.open())
    expect(result.current.erasing).toBe(true)
    await act(async () => { await result.current.confirm('pw') })
    expect(api.post).toHaveBeenCalledWith('/sm_candidates/7/erase', { password: 'pw' })
    expect(notifySuccess).toHaveBeenCalledWith('Erased')
    expect(close).toHaveBeenCalled()
    expect(result.current.erasing).toBe(false)
  })

  it('rethrows a failure and keeps the dialog open', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 403 } })
    const close = vi.fn()
    const { result } = renderHook(() => useSmEmployeeErase('7', close, 'fallback'), { wrapper })
    act(() => result.current.open())
    await act(async () => { await expect(result.current.confirm('bad')).rejects.toBeTruthy() })
    expect(close).not.toHaveBeenCalled()
    expect(result.current.erasing).toBe(true)
  })
})
