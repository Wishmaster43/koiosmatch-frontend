/**
 * useMatchAgentSessions — fetches the match's interview sessions,
 * maps them with conversationId passthrough, and surfaces loading/error/empty states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMatchAgentSessions } from './useMatchAgentSessions'

interface MockSession { id: string; category: string; conversation_id: string | null; agent: { name: string } }

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: { get: getMock }, unwrapList: (res: Record<string, unknown>) => res.data }))
vi.mock('@/pages/applications/shared', () => ({
  mapInterview: (raw: MockSession | undefined) => raw ? {
    category: raw.category || 'busy',
    agent: raw.agent || { name: 'Agent A' },
  } : null,
}))

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient()
  return React.createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useMatchAgentSessions', () => {
  beforeEach(() => { getMock.mockReset() })

  it('returns empty sessions when matchId is null', async () => {
    const { result } = renderHook(() => useMatchAgentSessions(null), { wrapper })
    expect(result.current.sessions).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.empty).toBe(true)
  })

  it('fetches and maps sessions with conversationId passthrough', async () => {
    getMock.mockResolvedValue({
      data: {
        rows: [
          { id: 's1', category: 'busy', conversation_id: 'c1', agent: { name: 'Agent A' } },
          { id: 's2', category: 'paused', conversation_id: null, agent: { name: 'Agent B' } },
        ],
      },
    })
    const { result } = renderHook(() => useMatchAgentSessions('m1'), { wrapper })
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(getMock).toHaveBeenCalledWith('/matches/m1/agent-sessions')
    expect(result.current.sessions).toHaveLength(2)
    expect(result.current.sessions[0].conversationId).toBe('c1')
    expect(result.current.sessions[1].conversationId).toBe(null)
  })

  it('surfaces loading, error and empty states correctly', async () => {
    getMock.mockResolvedValue({ data: { rows: [] } })
    const { result } = renderHook(() => useMatchAgentSessions('m1'), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => {
      expect(result.current.empty).toBe(true)
    })
    expect(result.current.error).toBe(null)
  })
})
