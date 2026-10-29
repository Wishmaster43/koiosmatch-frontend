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
import * as notifyModule from '@/lib/notify'
import * as extractModule from '@/lib/extractApiError'
import { useSettingsForm } from './useSettingsForm'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn(), post: vi.fn() } }
})

vi.mock('@/lib/notify', () => ({
  notifyError: vi.fn(),
}))

vi.mock('@/lib/extractApiError', () => ({
  extractApiError: vi.fn((err, fallback) => fallback || 'Save failed'),
}))

beforeEach(() => vi.clearAllMocks())

describe('useSettingsForm — load failure', () => {
  // BLANK-RESETS-1: a blank stored value on a typed default reads as the default.
  it('reads a stored blank on a numeric default as the default, not as 0', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { limit: '', flag: '' } })
    const { result } = renderHook(() => useSettingsForm({ limit: 60, flag: true }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.values).toEqual({ limit: 60, flag: true })
    expect(result.current.dirty).toBe(false)
  })

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


// Regression (27-08, full-suite flake root-caused): a SLOW load must not clobber
// what the user typed while it was in flight — the typed key survives the merge
// and stays dirty against the loaded baseline.
describe('useSettingsForm · slow load never clobbers in-flight edits', () => {
  it('keeps a value typed before the load resolves, and stays dirty', async () => {
    let resolveLoad
    vi.mocked(api.get).mockReturnValue(new Promise(r => { resolveLoad = r }))
    const { result } = renderHook(() => useSettingsForm({ note: '' }))
    act(() => result.current.set('note', 'typed-while-loading'))
    await act(async () => { resolveLoad({ data: { note: 'stored-on-server' } }); await Promise.resolve() })
    expect(result.current.values.note).toBe('typed-while-loading')
    expect(result.current.dirty).toBe(true)
  })
})

// Error handling (G2-schema-canedit): save failures must surface via notifyError
describe('useSettingsForm · save error handling', () => {
  it('calls notifyError when save fails (403, 422, network error, etc)', async () => {
    api.get.mockResolvedValue({ data: { retention_months_never_placed: '24' } })
    api.post.mockRejectedValue(new Error('Forbidden: 403'))
    const { result } = renderHook(() => useSettingsForm({ retention_months_never_placed: 24 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.set('retention_months_never_placed', 36))
    await act(async () => { await result.current.save() })

    // extractApiError is called with the error and the fallback message
    expect(vi.mocked(notifyModule.notifyError)).toHaveBeenCalled()
    expect(vi.mocked(extractModule.extractApiError)).toHaveBeenCalled()
  })
})

// S-008: the BE stores booleans as '1'/'0'; every spelling must read back correctly.
describe('useSettingsForm · boolean spellings and save round-trip', () => {
  it('reads "1"/"0" onto boolean defaults and does not flip them on an unrelated save', async () => {
    api.get.mockResolvedValue({ data: { flag_on: '1', flag_off: '0', note: 'a' } })
    api.post.mockResolvedValue({})
    const { result } = renderHook(() => useSettingsForm({ flag_on: false, flag_off: true, note: '' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.values).toMatchObject({ flag_on: true, flag_off: false })
    act(() => result.current.set('note', 'b'))
    await act(async () => { await result.current.save() })
    expect(api.post).toHaveBeenCalledWith('/settings', { flag_on: 'true', flag_off: 'false', note: 'b' })
  })
})

// S-011: a cleared number falls back to the catalogue default after a successful save.
describe('useSettingsForm · cleared value and 422 field errors', () => {
  it('shows the default and is clean after saving a null value, POSTing blank', async () => {
    api.get.mockResolvedValue({ data: { limit: '30' } })
    api.post.mockResolvedValue({})
    const { result } = renderHook(() => useSettingsForm({ limit: 60 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.set('limit', null))
    await act(async () => { await result.current.save() })
    expect(api.post).toHaveBeenCalledWith('/settings', { limit: '' })
    expect(result.current.values.limit).toBe(60)
    expect(result.current.dirty).toBe(false)
  })

  it('maps a 422 to fieldErrors, stays dirty and unsaved, and clears the error on edit', async () => {
    api.get.mockResolvedValue({ data: { top_cities_n: '10' } })
    api.post.mockRejectedValue({ response: { status: 422, data: { errors: { top_cities_n: ['must be at least 1'] } } } })
    const { result } = renderHook(() => useSettingsForm({ top_cities_n: 10 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.set('top_cities_n', 0))
    await act(async () => { await result.current.save() })
    expect(result.current.fieldErrors.top_cities_n).toBe('must be at least 1')
    expect(result.current.saved).toBe(false)
    expect(result.current.dirty).toBe(true)
    act(() => result.current.set('top_cities_n', 5))
    expect(result.current.fieldErrors.top_cities_n).toBeUndefined()
  })
})
