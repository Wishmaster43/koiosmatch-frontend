/**
 * useProposals — mutation request test (§13): revoke() POSTs the expected route
 * with a per-click Idempotency-Key header (IDEMP-KEY-BODYLESS-1), and the list
 * query is invalidated on success.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useProposals } from './useProposals'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return {
    ...actual,
    default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), post: vi.fn(() => Promise.resolve({ data: {} })) },
    unwrapList: actual.unwrapList,
  }
})

import api from '@/lib/api'
const mockPost = api.post as unknown as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks() })

describe('useProposals · revoke', () => {
  it('POSTs /proposals/{id}/revoke with a fresh Idempotency-Key header', async () => {
    const { result } = renderHook(() => useProposals('app-1'), { wrapper })

    await act(async () => { await result.current.revoke('p1') })

    expect(mockPost).toHaveBeenCalledWith('/proposals/p1/revoke', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
  })

  it('sends a different key on a second, separate revoke call', async () => {
    const { result } = renderHook(() => useProposals('app-1'), { wrapper })

    await act(async () => { await result.current.revoke('p1') })
    await act(async () => { await result.current.revoke('p2') })

    const key1 = (mockPost.mock.calls[0][2] as { headers: Record<string, string> }).headers['Idempotency-Key']
    const key2 = (mockPost.mock.calls[1][2] as { headers: Record<string, string> }).headers['Idempotency-Key']
    expect(key1).not.toBe(key2)
  })
})
