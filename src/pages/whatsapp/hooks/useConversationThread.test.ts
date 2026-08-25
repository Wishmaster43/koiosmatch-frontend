/**
 * useConversationThread — loads GET /conversations/{id}/messages, and "load
 * older" carries `before=<oldest loaded sent_at>` exactly (§13: assert the
 * request), prepending the reversed older chunk.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { useConversationThread } from './useConversationThread'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

describe('useConversationThread', () => {
  it('loads the initial window from GET /conversations/{id}/messages', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'm1', sent_at: '2026-08-20T10:00:00Z' }], has_older: true } })
    const { result } = renderHook(() => useConversationThread('conv-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/conversations/conv-1/messages')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.hasOlder).toBe(true)
  })

  it('loadOlder sends before=<oldest loaded sent_at> and prepends the reversed chunk', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'm2', sent_at: '2026-08-20T10:00:00Z' }], has_older: true } })
    const { result } = renderHook(() => useConversationThread('conv-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ id: 'm1-older-newest', sent_at: '2026-08-19T09:00:00Z' }, { id: 'm0-oldest', sent_at: '2026-08-19T08:00:00Z' }], has_older: false },
    })
    act(() => { result.current.loadOlder() })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/conversations/conv-1/messages', { params: { before: '2026-08-20T10:00:00Z' } }))
    await waitFor(() => expect(result.current.messages.map(m => m.id)).toEqual(['m0-oldest', 'm1-older-newest', 'm2']))
    expect(result.current.hasOlder).toBe(false)
  })
})
