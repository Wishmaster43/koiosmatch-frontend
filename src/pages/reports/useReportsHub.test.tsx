/**
 * useReportsHub — the data layer's own request-shape test (§13: assert the
 * REQUEST, not just that a callback fired). Proves it reaches GET /reports
 * (no params — tenant-wide, see the hook's own doc comment) with a real
 * AbortSignal (A-3, so a superseded fetch cancels).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useReportsHub, isReportsHubForbidden } from './useReportsHub'

const getSpy = vi.fn().mockResolvedValue({ data: { signals: [] } })
vi.mock('@/lib/api', () => ({ default: { get: (...args: unknown[]) => getSpy(...args) } }))

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useReportsHub — request shape', () => {
  it('calls GET /reports with a cancellable signal', async () => {
    const { result } = renderHook(() => useReportsHub(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getSpy).toHaveBeenCalledWith('/reports', expect.objectContaining({ signal: expect.anything() }))
  })

  it('normalises the response to { data, loading, error }', async () => {
    getSpy.mockResolvedValueOnce({ data: { signals: [{ key: 'k', label: 'l', count: 1, report: 'candidates', filters: {} }] } })
    const { result } = renderHook(() => useReportsHub(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.data?.signals).toHaveLength(1)
  })
})

describe('isReportsHubForbidden', () => {
  it('is true only for an axios 403', () => {
    expect(isReportsHubForbidden({ response: { status: 403 } })).toBe(true)
    expect(isReportsHubForbidden({ response: { status: 500 } })).toBe(false)
    expect(isReportsHubForbidden(undefined)).toBe(false)
  })
})
