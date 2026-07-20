/**
 * useContactFunctions — FUNCTIONS-SPLIT-1 (Danny 2026-07-20). Asserts the actual
 * GET /contact-functions request (not just that data loaded), that the seed
 * fallback holds while the request is pending, and that the response's own
 * `allow_free_entry` flag is honoured once the backend starts sending one (§13).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// useCachedLookup caches per URL at module scope (one fetch per session), so each
// case needs its own fresh module graph — otherwise a later test would just see an
// earlier test's cached response (mirrors FunctionsSettings.test.jsx's own reset).
async function freshHook() {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const mod = await import('./useContactFunctions')
  return { mockedGet: vi.mocked(apiModule.default.get), ...mod }
}

describe('useContactFunctions', () => {
  it('GETs /contact-functions on mount with no params', async () => {
    const { mockedGet, useContactFunctions } = await freshHook()
    mockedGet.mockResolvedValue({ data: [] })
    renderHook(() => useContactFunctions())
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/contact-functions', undefined))
  })

  it('keeps the seed fallback (and creatable default) while the request is pending', async () => {
    const { mockedGet, useContactFunctions, DEFAULT_CONTACT_FUNCTIONS } = await freshHook()
    mockedGet.mockReturnValue(new Promise(() => {})) // never resolves in this test
    const { result } = renderHook(() => useContactFunctions())
    expect(result.current.contactFunctions).toEqual(DEFAULT_CONTACT_FUNCTIONS)
    expect(result.current.allowFreeEntry).toBe(true)
  })

  it('maps the API rows and honours a false allow_free_entry once the backend sends one', async () => {
    const { mockedGet, useContactFunctions } = await freshHook()
    mockedGet.mockResolvedValue({ data: { data: ['Locatiemanager', 'Teamleider'], allow_free_entry: false } })
    const { result } = renderHook(() => useContactFunctions())
    await waitFor(() => expect(result.current.contactFunctions).toEqual(['Locatiemanager', 'Teamleider']))
    expect(result.current.allowFreeEntry).toBe(false)
  })
})
