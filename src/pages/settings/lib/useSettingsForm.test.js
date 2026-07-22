/**
 * useSettingsForm — the load-error path (audit finding A, AVG-sensitive): a failed
 * initial GET /settings must never read as "the tenant has no policy configured",
 * which would let Save silently overwrite the real (unknown) policy with the
 * hardcoded defaults. Asserts the hook flags `loadError` and refuses to persist
 * while it is set.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import api from '@/lib/api'
import { useSettingsForm } from './useSettingsForm'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

beforeEach(() => vi.clearAllMocks())

describe('useSettingsForm — load failure', () => {
  it('flags loadError when GET /settings rejects, instead of silently keeping defaults', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useSettingsForm({ retention_months_never_placed: 24 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loadError).toBe(true)
    // The hardcoded default is still in `values` — a consumer must not render/save
    // this as if it were the confirmed tenant policy (that is the consumer's job).
    expect(result.current.values.retention_months_never_placed).toBe(24)
  })

  it('refuses to save while loadError is set, even if the caller marks a value dirty', async () => {
    api.get.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useSettingsForm({ retention_months_never_placed: 24 }))
    await waitFor(() => expect(result.current.loadError).toBe(true))

    act(() => result.current.set('retention_months_never_placed', 36))
    await act(async () => { await result.current.save() })

    expect(api.post).not.toHaveBeenCalled()
  })

  it('does not set loadError on a successful load', async () => {
    api.get.mockResolvedValue({ data: { retention_months_never_placed: '36' } })
    const { result } = renderHook(() => useSettingsForm({ retention_months_never_placed: 24 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.loadError).toBe(false)
    expect(result.current.values.retention_months_never_placed).toBe(36)
  })
})
