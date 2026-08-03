/**
 * useScopedEntityList — the ONE fetch backing all four department/location
 * Vacatures/Matches sub-tabs (SCOPED-LIST-TAB-1). Pins the REQUEST shape per
 * combination (§13): VacancyQuery/MatchController validate `customer_department_id`/
 * `customer_location_id` as a SINGLE uuid, never the bracketed array form
 * `customer_id` uses — a wrong param name here is invisible in a way a 422 never
 * is (mirrors useCustomerVacancies.filter.test.ts's own reasoning). Also pins the
 * ERROR state: an id outside the caller's branch grant 404s (LOC-DEPT-TAB-1
 * guard) and must surface as `error: true`, never a silently empty list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useScopedEntityList } from './useScopedEntityList'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

const identity = (raw: Record<string, unknown>) => raw

beforeEach(() => vi.clearAllMocks())

describe('useScopedEntityList · the four department/location combinations', () => {
  it('vacancies × department: GET /vacancies with customer_department_id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useScopedEntityList('department-vacancies', '/vacancies', 'customer_department_id', 'dep-1', identity), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies')
    expect(config?.params).toMatchObject({ customer_department_id: 'dep-1' })
    expect(config?.params).not.toHaveProperty('customer_location_id')
  })

  it('vacancies × location: GET /vacancies with customer_location_id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useScopedEntityList('location-vacancies', '/vacancies', 'customer_location_id', 'loc-1', identity), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/vacancies')
    expect(config?.params).toMatchObject({ customer_location_id: 'loc-1' })
    expect(config?.params).not.toHaveProperty('customer_department_id')
  })

  it('matches × department: GET /matches with customer_department_id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useScopedEntityList('department-matches', '/matches', 'customer_department_id', 'dep-1', identity), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/matches')
    expect(config?.params).toMatchObject({ customer_department_id: 'dep-1' })
  })

  it('matches × location: GET /matches with customer_location_id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useScopedEntityList('location-matches', '/matches', 'customer_location_id', 'loc-1', identity), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/matches')
    expect(config?.params).toMatchObject({ customer_location_id: 'loc-1' })
  })
})

describe('useScopedEntityList · disabled + error states', () => {
  it('never fires while no id is known yet (disabled query)', () => {
    renderHook(() => useScopedEntityList('department-vacancies', '/vacancies', 'customer_department_id', undefined, identity), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('a 404 (outside the caller\'s branch grant) resolves as the ERROR state, never a silent empty list', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useScopedEntityList('department-vacancies', '/vacancies', 'customer_department_id', 'dep-1', identity), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.rows).toEqual([])
  })

  it('maps each row through the caller-supplied mapper', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'v-1', title: 'Verpleegkundige' }] } })
    const mapTitle = (raw: Record<string, unknown>) => String(raw.title)
    const { result } = renderHook(() => useScopedEntityList('department-vacancies', '/vacancies', 'customer_department_id', 'dep-1', mapTitle), { wrapper })
    await waitFor(() => expect(result.current.rows).toEqual(['Verpleegkundige']))
  })
})
