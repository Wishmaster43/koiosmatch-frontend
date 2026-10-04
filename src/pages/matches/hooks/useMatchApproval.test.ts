/**
 * useMatchApproval · approve — IDEMP-KEY-BODYLESS-1: the approve POST carries no body,
 * so it needs an explicit per-click Idempotency-Key so a double click never approves
 * the same match twice at the server (§13 request-asserting test).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMatchApproval } from './useMatchApproval'
import type { MatchRow } from '@/types/match'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: {} }), post: vi.fn() },
  unwrap: (res: { data?: unknown }) => res?.data,
}))
vi.mock('@/lib/notify', () => ({ notify: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const match = { id: 'm1', approval_status: 'pending' } as unknown as MatchRow

describe('useMatchApproval · approve', () => {
  it('sends an Idempotency-Key with the body-less approve POST', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useMatchApproval(match))

    await act(async () => { await result.current.approve() })

    expect(api.post).toHaveBeenCalledWith('/matches/m1/approve', undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  })
})
