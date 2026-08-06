import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIsNonEuNationality } from './useIsNonEuNationality'

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn() },
  unwrapList: (r: { data?: { data?: unknown[] } }) => ({ rows: r?.data?.data ?? [] }),
}))
import api from '@/lib/api'

describe('useIsNonEuNationality (KAND-WERKVERGUNNING-2)', () => {
  // Reset the shared mock's call history before every test — vitest does not do
  // this automatically, and the "resolves without fetching" test below asserts
  // api.get was never called, which only holds with a clean slate.
  beforeEach(() => { vi.mocked(api.get).mockClear() })

  it('resolves false (EU) for a nationality whose lookup row has is_eu: true', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ name: 'Nederlands', is_eu: true }] } })
    const { result } = renderHook(() => useIsNonEuNationality('Nederlands'))
    await waitFor(() => expect(result.current).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/nationalities')
  })

  it('resolves true (non-EU) for a nationality whose lookup row has is_eu: false', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ name: 'Marokkaans', is_eu: false }] } })
    const { result } = renderHook(() => useIsNonEuNationality('Marokkaans'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('fail-safe: no matching lookup row resolves to non-EU (mirrors the backend WorkPermitGuard)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ name: 'Nederlands', is_eu: true }] } })
    const { result } = renderHook(() => useIsNonEuNationality('Onbekende nationaliteit'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('fail-safe: a failed request resolves to non-EU rather than silently hiding the block', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useIsNonEuNationality('Marokkaans'))
    await waitFor(() => expect(result.current).toBe(true))
  })

  it('an empty/unset nationality resolves to non-EU without fetching', () => {
    const { result } = renderHook(() => useIsNonEuNationality(''))
    expect(result.current).toBe(true)
    expect(api.get).not.toHaveBeenCalled()
  })
})
