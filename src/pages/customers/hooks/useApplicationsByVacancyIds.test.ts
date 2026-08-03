/**
 * useApplicationsByVacancyIds — step 2 of the location/department Sollicitaties
 * chain (SOLLICITATIES-SCOPE-1): applications on a SET of vacancy ids (the
 * level's own vacancies, resolved separately by useScopedVacancyIds). Pins the
 * REQUEST shape (§13) — ApplicationQuery validates `vacancy_id` as an ARRAY of
 * uuids (ApplicationQuery.php:33/76-77), mirroring useCustomerApplications'
 * own `customer_id[]` proof — and the GUARD: ApplicationQuery.php:162 only
 * applies the `vacancy_id` whereIn when `Request::filled('vacancy_id')`, and
 * Laravel's `filled()` treats an empty array as blank — so an EMPTY
 * `vacancy_id[]` would silently return every application, unfiltered. This
 * hook must never fire for a zero-vacancy scope.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useApplicationsByVacancyIds } from './useCustomerDrawerData'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } } as { data: { data: unknown[] } })) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useApplicationsByVacancyIds', () => {
  it('sends vacancy_id as an ARRAY of exactly this level\'s ids', async () => {
    renderHook(() => useApplicationsByVacancyIds(['vac-1', 'vac-2'], []), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/applications')
    expect(config?.params).toMatchObject({ vacancy_id: ['vac-1', 'vac-2'] })
  })

  it('never fires for an EMPTY vacancy set — an empty vacancy_id[] would return every application unfiltered (ApplicationQuery.php:162)', () => {
    renderHook(() => useApplicationsByVacancyIds([], []), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it("maps rows through the applications page's own mapApplication, not a fork", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [{
          id: 'app-1', candidate: { id: 'cand-1', name: 'Jane Doe' }, vacancy: { id: 'vac-1', title: 'Verpleegkundige' },
          phase_key: 'applied', score: 82, created_at: '2026-07-01',
        }],
      },
    })
    const { result } = renderHook(() => useApplicationsByVacancyIds(['vac-1'], []), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const row = result.current.rows[0]
    expect(row.candidateName).toBe('Jane Doe')
    expect(row.vacancyTitle).toBe('Verpleegkundige')
    expect(row.phaseKey).toBe('applied')
    expect(row.score).toBe(82)
  })
})
