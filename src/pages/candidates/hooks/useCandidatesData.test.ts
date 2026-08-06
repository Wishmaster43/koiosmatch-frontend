/**
 * useCandidatesData · KAND-FILTERS-1 — the "Voorkeuren" filter params
 * (contract_types[] / hours_per_week_min / hours_per_week_max /
 * available_from_before) reach the /candidates GET request exactly as
 * CandidatesPage merges them into filterParams. The hook is a plain
 * pass-through of that object (§13: assert the REQUEST, not just that a
 * callback fired) — this pins that no key gets dropped, renamed or coerced
 * on the way to the server, AND-combined with the existing pagination params.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useCandidatesData } from './useCandidatesData'

// heavyGet (candidates/stats) is the shared guarded-GET wrapper (dedup + cooldown,
// module-level state) — stub it directly so its state never leaks between tests.
const heavyGetMock = vi.fn()
vi.mock('@/lib/heavyGet', () => ({ heavyGet: (...args: unknown[]) => heavyGetMock(...args) }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const t = ((k: string) => k) as unknown as import('i18next').TFunction

afterEach(() => vi.clearAllMocks())

describe('useCandidatesData · KAND-FILTERS-1 params reach the GET request', () => {
  it('forwards contract_types[]/hours_per_week_min/max/available_from_before untouched, AND-combined with pagination', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    const filterParams = {
      contract_types: ['freelance', 'payroll'],
      hours_per_week_min: 16,
      hours_per_week_max: 32,
      available_from_before: '2026-09-01',
    }
    renderHook(() => useCandidatesData({ filterParams, page: 2, pageSize: 25, t, setActionMsg: vi.fn() }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined

    expect(params?.contract_types).toEqual(['freelance', 'payroll'])
    expect(params?.hours_per_week_min).toBe(16)
    expect(params?.hours_per_week_max).toBe(32)
    expect(params?.available_from_before).toBe('2026-09-01')
    // AND-combined: pagination params still ride along unchanged.
    expect(params?.page).toBe(2)
    expect(params?.per_page).toBe(25)
  })

  it('omits the Voorkeuren keys entirely when the filter is unset (never sends empty/0)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    heavyGetMock.mockResolvedValue({ data: { data: null } })

    renderHook(() => useCandidatesData({ filterParams: {}, page: 1, pageSize: 25, t, setActionMsg: vi.fn() }), { wrapper })

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', expect.anything()))
    const call = vi.mocked(api.get).mock.calls.find(([url]) => url === '/candidates')
    const params = call?.[1]?.params as Record<string, unknown> | undefined

    expect(params).not.toHaveProperty('contract_types')
    expect(params).not.toHaveProperty('hours_per_week_min')
    expect(params).not.toHaveProperty('hours_per_week_max')
    expect(params).not.toHaveProperty('available_from_before')
  })
})
