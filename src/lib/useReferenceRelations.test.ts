/**
 * useReferenceRelations (REFERENTIE-VELDEN-1) — asserts the actual GET
 * /reference-relations request, that `id` (the field the save path must send,
 * NEVER `value`/`label` — see the hook's own file header) passes through, and
 * the seed-fallback behaviour (§13: assert the request, not just that data
 * loaded). useCachedLookup keeps a module-scope cache keyed by URL, so each
 * test re-imports the module tree (vi.resetModules) to start from a cold
 * cache — mirrors useEmergencyContactRelations.test.ts / useWorkPermitTypes.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Fresh module registry per test = cold lookup cache + fresh api mock.
async function mountReferenceRelations(response: unknown | Error) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const get = vi.mocked(apiModule.default.get)
  if (response instanceof Error) get.mockRejectedValue(response)
  else get.mockResolvedValue({ data: response } as AxiosResponse)
  const { useReferenceRelations } = await import('./useReferenceRelations')
  const rendered = renderHook(() => useReferenceRelations())
  return { ...rendered, get }
}

describe('useReferenceRelations · lookup mapping', () => {
  it('reads GET /reference-relations and passes id/value/label/color through as-is', async () => {
    /* eslint-disable no-restricted-syntax -- mock API response DATA, not UI styling */
    const { result, get } = await mountReferenceRelations([
      { id: 'a1', value: 'manager', label: 'Manager', color: '#6E8FD6', sort_order: 0, active: true, in_use: false },
      { id: 'a2', value: 'collega', label: 'Collega', color: '#5FB0AC', sort_order: 1, active: true, in_use: false },
    ])
    /* eslint-enable no-restricted-syntax */

    await waitFor(() => expect(result.current.referenceRelations).toHaveLength(2))
    expect(get).toHaveBeenCalledWith('/reference-relations', undefined)
    // The save path sends `id`, never `value`/`label` — assert it round-trips untouched.
    expect(result.current.referenceRelations[0]).toMatchObject({ id: 'a1', value: 'manager', label: 'Manager' })
  })

  it('falls back to the seeded Dutch relations when the endpoint fails', async () => {
    const { result } = await mountReferenceRelations(new Error('network down'))

    await waitFor(() => expect(result.current.referenceRelations.length).toBeGreaterThan(0))
    expect(result.current.referenceRelations.map(o => o.value)).toEqual([
      'manager', 'collega', 'klant', 'opdrachtgever', 'docent', 'anders',
    ])
  })

  it('keeps the fallback on a genuinely empty response rather than emptying the picker', async () => {
    const { result } = await mountReferenceRelations([])

    await waitFor(() => expect(result.current.referenceRelations.length).toBeGreaterThan(0))
  })
})
