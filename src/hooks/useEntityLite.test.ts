// Regression test for useEntityLite: verifies the request route and that the
// mapper output (not the raw payload) is returned.
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import api from '@/lib/api'
import { useEntityLite } from './useEntityLite'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: { get: vi.fn(() => Promise.resolve({ data: { data: { id: '7', name: 'Raw' } } })) },
  }
})

// Wraps the hook with a fresh QueryClient per test.
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('useEntityLite', () => {
  it('GETs `${path}/${id}` and applies the mapper to the unwrapped payload', async () => {
    const mapper = (raw: unknown) => ({ id: '7', initials: 'RA', name: (raw as { name: string }).name })
    const { result } = renderHook(() => useEntityLite('/things', mapper, '7'), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(api.get).toHaveBeenCalledWith('/things/7', expect.objectContaining({ signal: expect.anything() }))
    expect(result.current.entity).toEqual({ id: '7', initials: 'RA', name: 'Raw' })
  })
})
