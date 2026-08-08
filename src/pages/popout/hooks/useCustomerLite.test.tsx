/**
 * useCustomerLite — proves the light fetch resolves name/initials from the raw
 * customer response (no mapCustomer dependency), degrades to the error state on
 * a failed GET, and stays disabled (never calls the API) without an id. Mirrors
 * useCandidateLite.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCustomerLite } from './useCustomerLite'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
import api from '@/lib/api'
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useCustomerLite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves name + initials from the raw customer response', async () => {
    apiGet.mockResolvedValue({ data: { data: { id: 'cust-1', name: 'Zorgpartners B.V.' } } })
    const { result } = renderHook(() => useCustomerLite('cust-1'), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(apiGet).toHaveBeenCalledWith('/customers/cust-1', expect.objectContaining({}))
    expect(result.current.customer).toEqual({ id: 'cust-1', name: 'Zorgpartners B.V.', initials: 'ZB' })
    expect(result.current.error).toBe(false)
  })

  it('surfaces an error state (never a crash) when the GET fails', async () => {
    apiGet.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useCustomerLite('cust-2'), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.customer).toBeNull()
  })

  it('never calls the API without an id', () => {
    const { result } = renderHook(() => useCustomerLite(undefined), { wrapper })
    expect(apiGet).not.toHaveBeenCalled()
    expect(result.current.customer).toBeNull()
  })
})
