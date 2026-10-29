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
import { useProposals, proposalsPollInterval, PROPOSALS_POLL_DELAYS_MS } from './useProposals'

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

describe('useProposals · polling', () => {
  const NOW = Date.parse('2026-10-29T12:00:00Z')
  const queued = (sent_at: string | null) => [{ id: 'p1', send_status: 'queued', sent_at }] as never

  it('polls a fresh queued row after 15 s, backing off on later updates', () => {
    expect(proposalsPollInterval(queued(null), 1, NOW)).toBe(15_000)
    expect(proposalsPollInterval(queued('2026-10-29T11:59:00Z'), 2, NOW)).toBe(30_000)
    expect(proposalsPollInterval(queued(null), 3, NOW)).toBe(60_000)
  })

  it('stops once the queued row is older than the cutoff', () => {
    expect(proposalsPollInterval(queued('2026-10-29T11:00:00Z'), 1, NOW)).toBe(false)
  })

  it('stops once the update-count cap is reached', () => {
    expect(proposalsPollInterval(queued(null), PROPOSALS_POLL_DELAYS_MS.length + 1, NOW)).toBe(false)
  })

  it('stops when no row is queued any more (sent)', () => {
    expect(proposalsPollInterval([{ id: 'p1', send_status: 'sent', sent_at: null }] as never, 1, NOW)).toBe(false)
  })

  it('wires the query interval to the helper (15 s on the first load)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrap = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
    ;(api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { data: [{ id: 'p1', send_status: 'queued', sent_at: null }] } })
    const { result } = renderHook(() => useProposals('app-1'), { wrapper: wrap })
    await vi.waitFor(() => expect(result.current.proposals.length).toBe(1))
    const query = qc.getQueryCache().find({ queryKey: ['applications', 'app-1', 'proposals'] })!
    const interval = (query.options as { refetchInterval: (q: unknown) => number | false }).refetchInterval(query)
    expect(interval).toBe(15_000)
  })
})
