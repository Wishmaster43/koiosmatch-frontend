/**
 * useMatchScoreOverride — IDEMP-KEY-BODYLESS-1: the recalculate POST
 * (/applications/{id}/score) carries no body, so a sibling-tab/retry double click needs
 * a per-click Idempotency-Key header for the server to dedupe on (§13 — the request
 * itself, not only that a callback fired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useMatchScoreOverride } from './useMatchScoreOverride'
import type { ApplicationDetail } from '@/types/application'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const post = api.post as unknown as ReturnType<typeof vi.fn>

const app = (overrides: Partial<ApplicationDetail> = {}) =>
  ({ id: 1, score: 70, matchSource: 'ai', aiScore: 70, ...overrides } as Pick<ApplicationDetail, 'id' | 'score' | 'matchSource' | 'aiScore'>)

beforeEach(() => { post.mockReset() })

describe('useMatchScoreOverride · recalculateScore carries an Idempotency-Key', () => {
  it('POSTs /applications/{id}/score with a fresh header', async () => {
    post.mockResolvedValue({ data: { match_score: 80, match_score_source: 'ai', ai_match_score: 80 } })
    const { result } = renderHook(() => useMatchScoreOverride(app()))
    await act(async () => { result.current.recalculateScore() })
    expect(post).toHaveBeenCalledWith('/applications/1/score', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
  })
})
