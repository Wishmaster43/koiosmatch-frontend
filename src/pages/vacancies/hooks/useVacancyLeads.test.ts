/**
 * V14: the vacancy Leads expand panel must hit the DEDICATED VAC-LEADS-1 endpoint
 * (GET /vacancies/{id}/leads), never the count cell's own /candidate-matches
 * search route — the two return DIFFERENT populations (see useVacancyLeads's own
 * docblock): candidate-matches is the score-ranked search tab, /leads is the
 * appointment-tied set with no formal application yet. Mirrors
 * useVacancyMatches.test.ts's request-shape proof, §13.
 *
 * useRecountVacancyLeads tests the POST /vacancies/{id}/leads/recount endpoint,
 * which queues a manual rescan of AI-suggested candidates for one vacancy (B-48).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useVacancyLeads, useRecountVacancyLeads } from './useVacancyLeads'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    default: {
      get: vi.fn(() => Promise.resolve({ data: { data: [] } } as { data: { data: unknown[] } })),
      post: vi.fn(() => Promise.resolve({ data: { status: 'queued' } })),
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useVacancyLeads', () => {
  it('GETs the dedicated VAC-LEADS-1 route, not /candidate-matches', async () => {
    renderHook(() => useVacancyLeads('vac-1', true), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies/vac-1/leads')
  })

  it('stays disabled while `enabled` is false (row not expanded)', () => {
    renderHook(() => useVacancyLeads('vac-1', false), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('never fires while no vacancyId is known yet, even when enabled', () => {
    renderHook(() => useVacancyLeads(undefined, true), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('maps the raw VacancyLeadResource rows tolerantly', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ id: 'cand-1', name: 'Jane Doe', phase: 'lead', source: 'career_site', created_at: '2026-08-01T00:00:00Z' }] },
    })
    const { result } = renderHook(() => useVacancyLeads('vac-1', true), { wrapper })
    await waitFor(() => expect(result.current.rows).toHaveLength(1))
    const row = result.current.rows[0]
    expect(row.id).toBe('cand-1')
    expect(row.name).toBe('Jane Doe')
    expect(row.phase).toBe('lead')
    expect(row.source).toBe('career_site')
  })
})

describe('useRecountVacancyLeads', () => {
  it('POSTs to /vacancies/{id}/leads/recount with an empty body (B-48)', async () => {
    const { result } = renderHook(() => useRecountVacancyLeads(), { wrapper })
    await result.current.mutate('vac-1')

    expect(api.post).toHaveBeenCalledWith(
      '/vacancies/vac-1/leads/recount',
      {},
      { quietStatuses: [429] }
    )
  })

  it('returns the 202 response body {status:"queued"}', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { status: 'queued' } })
    const { result } = renderHook(() => useRecountVacancyLeads(), { wrapper })
    const resp = await result.current.mutate('vac-1')

    expect(resp).toEqual({ status: 'queued' })
  })

  it('lets 429 throttle responses propagate (quietStatuses handling)', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 429 } })
    const { result } = renderHook(() => useRecountVacancyLeads(), { wrapper })

    await expect(result.current.mutate('vac-1')).rejects.toEqual({ response: { status: 429 } })
  })
})
