/**
 * V-table-2: the vacancy Matches tab must hit the DEDICATED per-vacancy read
 * endpoint (GET /vacancies/{id}/matches), never the generic /matches list with
 * a vacancy_id filter — mirrors useCustomerMatches.test.ts's own proof that the
 * request shape (not just "a callback fired") is what this pins, §13.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useVacancyMatches } from './useVacancyMatches'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } } as { data: { data: unknown[] } } )) } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useVacancyMatches', () => {
  it('GETs the dedicated per-vacancy matches route', async () => {
    renderHook(() => useVacancyMatches('vac-1'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies/vac-1/matches')
  })

  it('never fires while no vacancyId is known yet (disabled query)', () => {
    renderHook(() => useVacancyMatches(undefined), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('maps rows through the shared mapMatch() output (proves reuse, not a fork)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{
        id: 'm-1', candidate: { id: 'cand-1', name: 'Jane Doe' }, vacancy: { id: 'vac-1', title: 'Verpleegkundige' },
        status: 'open', match_score: 80,
      }] },
    })
    const { result } = renderHook(() => useVacancyMatches('vac-1'), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const row = result.current.rows[0]
    expect(row.candidate).toBe('Jane Doe')
    expect(row.candidateId).toBe('cand-1')
    expect(row.vacancy).toBe('Verpleegkundige')
    expect(row.score).toBe(80)
  })
})
