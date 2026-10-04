/**
 * koiosmodels/api.test — proves the REQUEST shape of the manual "refresh" action
 * (CLAUDE.md §13: a mutation test asserts method/route/body, never only that a
 * callback fired). IDEMP-KEY-BODYLESS-1: the refresh POST is body-less and
 * click-triggered, so it must carry a fresh per-click Idempotency-Key.
 */
import { describe, it, expect, vi } from 'vitest'
import api from '@/lib/api'
import { refreshKoiosModelsAdmin } from './api'

// Keep the real unwrap helper, stub only the default client.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, get: vi.fn(), patch: vi.fn(), post: vi.fn() } }
})

describe('refreshKoiosModelsAdmin', () => {
  it('POSTs the refresh route with a per-click Idempotency-Key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { flavors: {} } } })
    await refreshKoiosModelsAdmin()
    expect(api.post).toHaveBeenCalledWith(
      '/superadmin/koios/models/refresh',
      undefined,
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
    )
  })
})
