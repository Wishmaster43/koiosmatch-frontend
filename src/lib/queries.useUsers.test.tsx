import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { useUsers } from './queries'

const mockAuth = vi.fn<() => unknown>(() => ({ hasPermission: () => true }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mockAuth() }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() }, getActiveTenantId: () => 't1' }
})

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// USERS-403-1: no request without users.view, and a stable empty array whenever the server gave nothing.
describe('useUsers · permission gate and stable data', () => {
  beforeEach(() => { vi.mocked(api.get).mockReset() })

  it('never calls GET /users for a caller without users.view and hands back one stable empty array', async () => {
    mockAuth.mockReturnValue({ hasPermission: (p: string) => p !== 'users.view' })
    const { result, rerender } = renderHook(() => useUsers(), { wrapper: wrap() })
    const first = result.current.data
    rerender()
    expect(api.get).not.toHaveBeenCalled()
    expect(first).toEqual([])
    expect(result.current.data).toBe(first)
  })

  it('keeps data a stable empty array when the request fails', async () => {
    mockAuth.mockReturnValue({ hasPermission: () => true })
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } })
    const { result, rerender } = renderHook(() => useUsers(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    const afterError = result.current.data
    rerender()
    expect(afterError).toEqual([])
    expect(result.current.data).toBe(afterError)
  })

  it('loads the rows for a caller with users.view', async () => {
    mockAuth.mockReturnValue({ hasPermission: () => true })
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'u1', name: 'Kelly' }] } })
    const { result } = renderHook(() => useUsers(), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'u1', name: 'Kelly' }]))
    expect(api.get).toHaveBeenCalledWith('/users', expect.anything())
  })
})
