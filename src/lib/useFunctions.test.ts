/**
 * useFunctions — FUNC-FREEENTRY-FIX (2026-08-17). Asserts the actual GET /functions
 * request, the seed fallback while pending, and that `allowFreeEntry` is read
 * straight off THIS response's own `allow_free_entry` flag — never a second,
 * disconnected tenant-settings-blob key (`functions_allow_free_entry`, which the
 * backend never reads for this lookup).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// useCachedLookup caches per URL at module scope (one fetch per session), so each
// case needs its own fresh module graph.
async function freshHook() {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const mod = await import('./useFunctions')
  return { mockedGet: vi.mocked(apiModule.default.get), ...mod }
}

describe('useFunctions', () => {
  it('GETs /functions on mount with no params', async () => {
    const { mockedGet, useFunctions } = await freshHook()
    mockedGet.mockResolvedValue({ data: [] })
    renderHook(() => useFunctions())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/functions', undefined))
  })

  it('keeps the seed fallback (and the strict default) while the request is pending', async () => {
    const { mockedGet, useFunctions, DEFAULT_FUNCTIONS } = await freshHook()
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves in this test
    const { result } = renderHook(() => useFunctions())
    expect(result.current.functions).toEqual(DEFAULT_FUNCTIONS)
    expect(result.current.allowFreeEntry).toBe(false)
  })

  it('maps the API rows and honours a true allow_free_entry from the response', async () => {
    const { mockedGet, useFunctions } = await freshHook()
    mockedGet.mockResolvedValue({ data: { data: ['Verzorgende', 'Helpende'], allow_free_entry: true } })
    const { result } = renderHook(() => useFunctions())
    await waitFor(() => expect(result.current.functions).toEqual(['Verzorgende', 'Helpende']))
    expect(result.current.allowFreeEntry).toBe(true)
  })

  it('reads allowFreeEntry straight off the response — no settings-blob shadow key', async () => {
    const { mockedGet, useFunctions } = await freshHook()
    mockedGet.mockResolvedValue({ data: { data: [], allow_free_entry: true } })
    const { result } = renderHook(() => useFunctions())
    await waitFor(() => expect(result.current.allowFreeEntry).toBe(true))
    // Only the dedicated lookup endpoint is ever called — no /settings fetch.
    expect(mockedGet).not.toHaveBeenCalledWith('/settings', expect.anything())
  })
})
