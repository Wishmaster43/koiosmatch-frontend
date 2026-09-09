import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDuplicateProbe } from './useDuplicateProbe'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { ...actual.default, post: vi.fn() } }
})

const KEYS = ['email', 'mobile', 'phone'] as const

// Asserts the exact request the shared probe sends: POST body, never query params.
describe('useDuplicateProbe', () => {
  it('posts the mapped body to the given path once debounced', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockResolvedValue({ data: { exists: true, match: { id: '1' } } })
    const { result } = renderHook(() => useDuplicateProbe('/candidates/check-duplicate', KEYS, 'a@b.com', '', ''))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/candidates/check-duplicate',
      { email: 'a@b.com', mobile: undefined, phone: undefined },
      expect.objectContaining({ signal: expect.anything() }),
    ))
    await waitFor(() => expect(result.current.probeMatch).toEqual({ id: '1' }))
  })

  it('does not probe when all three fields are empty', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.post).mockClear()
    renderHook(() => useDuplicateProbe('/candidates/check-duplicate', KEYS, '', '', ''))
    await new Promise(r => setTimeout(r, 20))
    expect(api.post).not.toHaveBeenCalled()
  })
})
