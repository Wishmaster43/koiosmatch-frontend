/**
 * useCustomerPhases (KLANT-FASE-1) — the customer lifecycle-phase lookup.
 *
 * The point of these tests is the FLAG CONTRACT (§3B): the hook must answer "which
 * phase does a new customer start in?" and "does this phase count as a real
 * customer?" from `is_default` / `is_customer`, NEVER from the seeded slugs
 * 'prospect' / 'klant'. Every fixture below therefore uses tenant-renamed slugs and
 * labels — an implementation that string-matches a slug fails them.
 *
 * useCachedLookup keeps a module-scope cache keyed by URL, and this hook always uses
 * the same URL, so each test re-imports the module tree (vi.resetModules) to start
 * from a cold cache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

// Fresh module registry per test = cold lookup cache + fresh api mock.
async function mountPhases(response: unknown | Error) {
  vi.resetModules()
  const apiModule = await import('@/lib/api')
  const get = vi.mocked(apiModule.default.get)
  if (response instanceof Error) get.mockRejectedValue(response)
  else get.mockResolvedValue({ data: response } as AxiosResponse)
  const { useCustomerPhases } = await import('./useCustomerPhases')
  const rendered = renderHook(() => useCustomerPhases())
  return { ...rendered, get }
}

beforeEach(() => vi.clearAllMocks())

/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */

describe('useCustomerPhases · lookup mapping', () => {
  it('reads GET /customer-phases and maps label/colour/flags, dropping inactive rows and honouring sort_order', async () => {
    const { result, get } = await mountPhases([
      { id: 'p2', value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', sort_order: 1, active: true, is_customer: true, is_default: false },
      { id: 'p3', value: 'oud', label: 'Oud', color: '#999999', sort_order: 2, active: false, is_customer: false, is_default: false },
      { id: 'p1', value: 'interesse', label: 'Interesse', color: '#1B60A9', sort_order: 0, active: true, is_customer: false, is_default: true },
    ])

    // Wait for the API rows specifically: the seed fallback also has two rows, so a
    // length-only wait would let the assertions run against the seed.
    await waitFor(() => expect(result.current.phases[0].value).toBe('interesse'))
    expect(get).toHaveBeenCalledWith('/customer-phases', undefined)
    expect(result.current.phases).toHaveLength(2)
    expect(result.current.phases.map(p => p.value)).toEqual(['interesse', 'vaste_klant'])
    expect(result.current.phaseMeta('vaste_klant')).toMatchObject({ label: 'Vaste klant', color: '#16A34A', isCustomer: true })
  })

  it('falls back to the seed when the endpoint fails — never an empty picker', async () => {
    const { result } = await mountPhases(new Error('network down'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.phases.length).toBeGreaterThan(0)
    expect(result.current.defaultPhase).toBeTruthy()
  })
})

describe('useCustomerPhases · binds on behaviour flags, never on a slug', () => {
  it('takes defaultPhase from is_default even when no phase is called "prospect"', async () => {
    const { result } = await mountPhases([
      { id: 'p1', value: 'vaste_klant', label: 'Vaste klant', sort_order: 0, active: true, is_customer: true, is_default: false },
      { id: 'p2', value: 'interesse', label: 'Interesse', sort_order: 1, active: true, is_customer: false, is_default: true },
    ])

    await waitFor(() => expect(result.current.phases[0].value).toBe('vaste_klant'))
    // The is_default row is SECOND and is not named "prospect" — a slug/index-based
    // implementation would answer 'vaste_klant' here.
    expect(result.current.defaultPhase).toBe('interesse')
  })

  it('answers isCustomerPhase from is_customer even when no phase is called "klant"', async () => {
    const { result } = await mountPhases([
      { id: 'p1', value: 'interesse', label: 'Interesse', sort_order: 0, active: true, is_customer: false, is_default: true },
      { id: 'p2', value: 'vaste_klant', label: 'Vaste klant', sort_order: 1, active: true, is_customer: true, is_default: false },
    ])

    await waitFor(() => expect(result.current.phases[0].value).toBe('interesse'))
    expect(result.current.isCustomerPhase('vaste_klant')).toBe(true)
    expect(result.current.isCustomerPhase('interesse')).toBe(false)
    // A row literally called 'klant' that does NOT carry the flag is not a customer.
    expect(result.current.isCustomerPhase('klant')).toBe(false)
  })

  it('renders an unknown/retired phase instead of crashing on it', async () => {
    const { result } = await mountPhases([
      { id: 'p1', value: 'interesse', label: 'Interesse', sort_order: 0, active: true, is_default: true },
    ])

    await waitFor(() => expect(result.current.phases).toHaveLength(1))
    expect(result.current.phaseMeta('gone')).toMatchObject({ value: 'gone', label: 'gone', isCustomer: false })
  })
})
/* eslint-enable no-restricted-syntax */
