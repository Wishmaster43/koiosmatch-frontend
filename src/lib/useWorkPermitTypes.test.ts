/**
 * useWorkPermitTypes (KAND-WERKVERGUNNING-LOOKUP-1) — asserts the actual GET
 * /work-permit-types request and the seed-fallback behaviour (§13: assert the
 * request, not just that data loaded). useCachedLookup keeps a module-scope
 * cache keyed by URL, so each test re-imports the module tree (vi.resetModules)
 * to start from a cold cache — mirrors useCountriesLookup.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Fresh module registry per test = cold lookup cache + fresh api mock.
async function mountWorkPermitTypes(response: unknown | Error) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const get = vi.mocked(apiModule.default.get)
  if (response instanceof Error) get.mockRejectedValue(response)
  else get.mockResolvedValue({ data: response } as AxiosResponse)
  const { useWorkPermitTypes } = await import('./useWorkPermitTypes')
  const rendered = renderHook(() => useWorkPermitTypes())
  return { ...rendered, get }
}

describe('useWorkPermitTypes · lookup mapping', () => {
  it('reads GET /work-permit-types and passes value/label/color through as-is', async () => {
    /* eslint-disable no-restricted-syntax -- mock API response DATA, not UI styling */
    const { result, get } = await mountWorkPermitTypes([
      { id: 'a1', value: 'twv', label: 'Tewerkstellingsvergunning (TWV)', color: '#DDA071', sort_order: 0, active: true, in_use: false },
      { id: 'a2', value: 'gvva', label: 'Gecombineerde vergunning (GVVA)', color: '#6E8FD6', sort_order: 1, active: true, in_use: false },
    ])
    /* eslint-enable no-restricted-syntax */

    await waitFor(() => expect(result.current.workPermitTypes).toHaveLength(2))
    expect(get).toHaveBeenCalledWith('/work-permit-types', undefined)
    expect(result.current.workPermitTypes[0]).toMatchObject({ value: 'twv', label: 'Tewerkstellingsvergunning (TWV)' })
  })

  it('falls back to the seeded Dutch work-permit types when the endpoint fails', async () => {
    const { result } = await mountWorkPermitTypes(new Error('network down'))

    await waitFor(() => expect(result.current.workPermitTypes.length).toBeGreaterThan(0))
    expect(result.current.workPermitTypes.map(o => o.value)).toEqual([
      'geen_vergunning_nodig', 'twv', 'gvva', 'kennismigrant', 'onbekend',
    ])
  })

  it('keeps the fallback on a genuinely empty response rather than emptying the picker', async () => {
    const { result } = await mountWorkPermitTypes([])

    await waitFor(() => expect(result.current.workPermitTypes.length).toBeGreaterThan(0))
  })
})
