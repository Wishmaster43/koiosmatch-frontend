/**
 * useScopedVacancyIds — step 1 of the location/department Sollicitaties chain
 * (SOLLICITATIES-SCOPE-1): this level's OWN vacancy ids, via the EXACT same
 * scoped query useScopedEntityList/ScopedVacanciesTab already use (same
 * queryKey/endpoint/paramName + the shared mapVacancyRow) — so when the
 * Vacatures sub-tab was already opened in this drawer session, react-query
 * answers from cache instead of firing a second request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useScopedVacancyIds, mapVacancyRow } from './useCustomerDrawerData'
import { useScopedEntityList } from './useScopedEntityList'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

// ONE shared client across the tests in the last describe block below, so a
// cache entry populated by one renderHook call is still there for the next —
// exactly what proves the cache-reuse claim. `staleTime` mirrors the app's real
// queryClient (lib/queryClient.ts: 30s) — react-query treats data as stale
// (background-refetch-on-mount) after 0ms by default, which would fire a SECOND
// request here even off a warm cache and hide the exact regression this test
// guards against. Cleared in beforeEach so no fixture leaks between unrelated tests.
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)

beforeEach(() => { vi.clearAllMocks(); client.clear() })

describe('useScopedVacancyIds · request shape', () => {
  it('location scope: GET /vacancies with customer_location_id, derives the ids', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'vac-1' }, { id: 'vac-2' }] } })
    const { result } = renderHook(() => useScopedVacancyIds('location', 'loc-1'), { wrapper })
    await waitFor(() => expect(result.current.vacancyIds).toEqual(['vac-1', 'vac-2']))
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies')
    expect(config?.params).toMatchObject({ customer_location_id: 'loc-1' })
  })

  it('department scope: GET /vacancies with customer_department_id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useScopedVacancyIds('department', 'dep-1'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [, config] = vi.mocked(api.get).mock.calls[0]
    expect(config?.params).toMatchObject({ customer_department_id: 'dep-1' })
  })

  it("never fires while no id is known yet (disabled query — the caller's own laziness gate)", () => {
    renderHook(() => useScopedVacancyIds('location', undefined), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('drops ids-less rows defensively (a row missing its own id contributes nothing to filter by)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'vac-1' }, { title: 'no id' }] } })
    const { result } = renderHook(() => useScopedVacancyIds('location', 'loc-1'), { wrapper })
    await waitFor(() => expect(result.current.vacancyIds).toEqual(['vac-1']))
  })
})

describe('useScopedVacancyIds · shares its cache with the Vacatures sub-tab (SCOPED-LIST-TAB-1)', () => {
  it('answers from the cache ScopedVacanciesTab (useScopedEntityList) already populated — no second request', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'vac-1' }] } })
    // Seed the cache exactly the way ScopedVacanciesTab itself does: same
    // queryKey shape, same mapper — mirrors a Vacatures sub-tab opened earlier
    // in the same drawer session.
    const { result: first } = renderHook(
      () => useScopedEntityList('location-vacancies', '/vacancies', 'customer_location_id', 'loc-1', mapVacancyRow),
      { wrapper },
    )
    await waitFor(() => expect(first.current.rows).toHaveLength(1))
    vi.mocked(api.get).mockClear()

    const { result: second } = renderHook(() => useScopedVacancyIds('location', 'loc-1'), { wrapper })
    await waitFor(() => expect(second.current.vacancyIds).toEqual(['vac-1']))
    // The cached entry from the "Vacatures" tab already answers it — no new request.
    expect(api.get).not.toHaveBeenCalled()
  })
})
