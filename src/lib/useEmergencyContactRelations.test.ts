/**
 * useEmergencyContactRelations (NOODCONTACT-VELDEN-1) — asserts the actual GET
 * /emergency-contact-relations request, that `id` (the field the save path must
 * send, NEVER `value`/`label` — see the hook's own file header) passes through,
 * and the seed-fallback behaviour (§13: assert the request, not just that data
 * loaded). useCachedLookup keeps a module-scope cache keyed by URL, so each test
 * re-imports the module tree (vi.resetModules) to start from a cold cache —
 * mirrors useWorkPermitTypes.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Fresh module registry per test = cold lookup cache + fresh api mock.
async function mountEmergencyContactRelations(response: unknown | Error) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const get = vi.mocked(apiModule.default.get)
  if (response instanceof Error) get.mockRejectedValue(response)
  else get.mockResolvedValue({ data: response } as AxiosResponse)
  const { useEmergencyContactRelations } = await import('./useEmergencyContactRelations')
  const rendered = renderHook(() => useEmergencyContactRelations())
  return { ...rendered, get }
}

describe('useEmergencyContactRelations · lookup mapping', () => {
  it('reads GET /emergency-contact-relations and passes id/value/label/color through as-is', async () => {
    /* eslint-disable no-restricted-syntax -- mock API response DATA, not UI styling */
    const { result, get } = await mountEmergencyContactRelations([
      { id: 'a1', value: 'partner', label: 'Partner', color: '#6E8FD6', sort_order: 0, active: true, in_use: false },
      { id: 'a2', value: 'ouder', label: 'Ouder', color: '#79B58E', sort_order: 1, active: true, in_use: false },
    ])
    /* eslint-enable no-restricted-syntax */

    await waitFor(() => expect(result.current.emergencyContactRelations).toHaveLength(2))
    expect(get).toHaveBeenCalledWith('/emergency-contact-relations', undefined)
    // The save path sends `id`, never `value`/`label` — assert it round-trips untouched.
    expect(result.current.emergencyContactRelations[0]).toMatchObject({ id: 'a1', value: 'partner', label: 'Partner' })
  })

  it('falls back to the seeded Dutch relations when the endpoint fails', async () => {
    const { result } = await mountEmergencyContactRelations(new Error('network down'))

    await waitFor(() => expect(result.current.emergencyContactRelations.length).toBeGreaterThan(0))
    expect(result.current.emergencyContactRelations.map(o => o.value)).toEqual([
      'partner', 'ouder', 'kind', 'broer_zus', 'vriend', 'familie', 'anders',
    ])
  })

  it('keeps the fallback on a genuinely empty response rather than emptying the picker', async () => {
    const { result } = await mountEmergencyContactRelations([])

    await waitFor(() => expect(result.current.emergencyContactRelations.length).toBeGreaterThan(0))
  })
})
