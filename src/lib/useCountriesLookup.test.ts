/**
 * useCountriesLookup (COUNTRY-LOOKUP-1) — asserts the actual GET request and that
 * display labels are resolved via the LOCAL Intl-based getCountryName, never the
 * backend's Dutch-only `name` field (§13: assert the request/behaviour, not just
 * that data loaded). useCachedLookup keeps a module-scope cache keyed by URL, and
 * this hook always uses the same URL, so each test re-imports the module tree
 * (vi.resetModules) to start from a cold cache — the real i18n singleton is
 * re-imported in the SAME post-reset module graph (never imported once at the top
 * of the file) so react-i18next's useTranslation() binds to the instance this
 * test actually initialised, not a stale pre-reset one.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Fresh module registry per test = cold lookup cache + fresh api mock + fresh i18n.
async function mountCountries(response: unknown | Error) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const get = vi.mocked(apiModule.default.get)
  if (response instanceof Error) get.mockRejectedValue(response)
  else get.mockResolvedValue({ data: response } as AxiosResponse)
  // Re-init the real i18next singleton (defaults to 'nl') in THIS fresh module
  // graph, before the hook's own `useTranslation()` import resolves it.
  await import('@/i18n')
  const { useCountriesLookup } = await import('./useCountriesLookup')
  const rendered = renderHook(() => useCountriesLookup())
  return { ...rendered, get }
}

describe('useCountriesLookup · lookup mapping', () => {
  it('reads GET /countries and resolves each code to an Intl display name, ignoring the backend Dutch name', async () => {
    const { result, get } = await mountCountries([
      { code: 'NL', name: 'Nederland' },
      { code: 'BE', name: 'België' },
      { code: 'FR', name: 'Frankrijk' },
    ])

    await waitFor(() => expect(result.current.options).toHaveLength(3))
    expect(get).toHaveBeenCalledWith('/countries', undefined)
    expect(result.current.options).toEqual([
      { value: 'NL', label: 'Nederland' },
      { value: 'BE', label: 'België' },
      { value: 'FR', label: 'Frankrijk' },
    ])
  })

  it('falls back to the seeded operating-country codes when the endpoint fails', async () => {
    const { result } = await mountCountries(new Error('network down'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.options.map(o => o.value)).toEqual(['NL', 'BE', 'DE', 'FR', 'ES', 'GB', 'IE'])
  })

  it('keeps the fallback on a genuinely empty response rather than emptying the picker', async () => {
    const { result } = await mountCountries([])

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.options.length).toBeGreaterThan(0)
  })
})
