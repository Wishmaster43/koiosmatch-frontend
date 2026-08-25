/**
 * useConversations — K-193/K-194: the tab's filters reach GET /conversations as
 * real server params, never a client-side slice (§13: assert the request).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useConversations } from './useConversations'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

afterEach(() => vi.clearAllMocks())

describe('useConversations', () => {
  it('requests GET /conversations with only per_page when no filter is active', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useConversations({}), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations', { params: { per_page: 50 }, signal: expect.anything() }))
  })

  it('forwards escalated/unanswered/active/search as real boolean/string params', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useConversations({ escalated: true, unanswered: true, active: true, search: 'jane' }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations', {
      params: { per_page: 50, escalated: true, unanswered: true, active: true, search: 'jane' },
      signal: expect.anything(),
    }))
  })
})
