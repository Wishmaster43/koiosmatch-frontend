/**
 * useInterviewSessionActions — IDEMP-KEY-BODYLESS-1: the stop-interview/resume-interview
 * POSTs carry no body, so a sibling-tab/retry double click needs a per-click
 * Idempotency-Key header for the server to dedupe on (§13 — the request itself, not
 * only that a callback fired). Behaviour otherwise covered via InterviewStatusCard.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/lib/api'
import { useInterviewSessionActions } from './useInterviewSessionActions'
import type { ApplicationInterview } from '@/types/application'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { post: vi.fn(), get: vi.fn() } }
})
vi.mock('@/lib/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))

const post = api.post as unknown as ReturnType<typeof vi.fn>
const get = api.get as unknown as ReturnType<typeof vi.fn>

const interview = (overrides: Partial<ApplicationInterview> = {}): ApplicationInterview => ({
  id: 'iv-1', category: 'busy', turn: null, pausedAt: null,
  ...overrides,
} as ApplicationInterview)

beforeEach(() => { post.mockReset(); get.mockReset() })

describe('useInterviewSessionActions · body-less POSTs carry an Idempotency-Key', () => {
  it('onStop POSTs stop-interview with a fresh header', async () => {
    post.mockResolvedValue({ data: { status: 'paused', paused_at: null } })
    get.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useInterviewSessionActions({
      interview: interview(), applicationId: 'app-1', canManage: true,
    }))
    await act(async () => { result.current.onStop() })
    expect(post).toHaveBeenCalledWith('/applications/app-1/stop-interview', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
  })

  it('onResume POSTs resume-interview with a fresh header', async () => {
    post.mockResolvedValue({ data: { status: 'active', paused_at: null } })
    get.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useInterviewSessionActions({
      interview: interview({ category: 'paused' }), applicationId: 'app-1', canManage: true,
    }))
    await act(async () => { result.current.onResume() })
    expect(post).toHaveBeenCalledWith('/applications/app-1/resume-interview', undefined, expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
  })
})
