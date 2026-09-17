/**
 * useOutreachFleetStats — KPI-RIJ-9-1 (OUTREACH-STATS-1). Asserts the request
 * route and that the response is unwrapped, and that a 404 (endpoint not built
 * on an older tenant/environment) degrades to null rather than surfacing an
 * error — §13: assert the request, not just that a callback fired.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useOutreachFleetStats } from './useOutreachFleetStats'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useOutreachFleetStats · request', () => {
  it('requests GET /outreach-campaigns/stats and returns the bare stats object', async () => {
    const body = { by_status: { todo: 4, contacted: 4, skipped: 4, answered: 4 }, by_channel: { call: 1, email: 1, whatsapp: 0 }, called_today: 0, to_call: 2, reached_pct: 66.7, overdue: 0 }
    // The endpoint answers the bare object (OutreachCampaignController::overallStats, no envelope).
    vi.mocked(api.get).mockResolvedValue({ data: body })
    const { result } = renderHook(() => useOutreachFleetStats(), { wrapper })

    await waitFor(() => expect(result.current).toEqual(body))
    expect(api.get).toHaveBeenCalledWith('/outreach-campaigns/stats', expect.anything())
  })

  it('degrades to null on a 404 (endpoint not yet available) instead of throwing', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useOutreachFleetStats(), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })
})
