import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useKoiosEntitySearch } from './useKoiosEntitySearch'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

describe('useKoiosEntitySearch', () => {
  beforeEach(() => { mockGet.mockReset(); vi.useRealTimers() })

  // Below the 2-char threshold, never touches the API — mirrors the candidates pilot.
  it('stays empty and never calls the API below the minimum query length', async () => {
    const { result } = renderHook(() => useKoiosEntitySearch('vacancies', 'a'))
    await new Promise((r) => setTimeout(r, 260))
    expect(result.current.results).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })

  // A category with no `search` config (locations) reports unsupported and never fetches.
  it('reports unsupported for a category without search wiring', async () => {
    const { result } = renderHook(() => useKoiosEntitySearch('locations', 'amsterdam'))
    await new Promise((r) => setTimeout(r, 260))
    expect(result.current.unsupported).toBe(true)
    expect(result.current.results).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })

  // The vacancies category uses the `search` param + its own present() mapping.
  it('searches vacancies with the search param and maps title/customer', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'v1', title: 'Verpleegkundige', customer: { name: 'Ziekenhuis A' } }] } })
    const { result } = renderHook(() => useKoiosEntitySearch('vacancies', 'verpl'))
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(mockGet).toHaveBeenCalledWith('/vacancies', expect.objectContaining({
      params: { search: 'verpl', per_page: 5 },
    }))
    expect(result.current.results[0]).toEqual({ id: 'v1', name: 'Verpleegkundige', subtitle: 'Ziekenhuis A' })
  })

  // Tasks/outreach/departments/contacts use `q`, not `search` (measured gap).
  it('searches tasks with the q param, not search', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 't1', title: 'Bel terug', status: { label: 'Open' } }] } })
    const { result } = renderHook(() => useKoiosEntitySearch('tasks', 'bel'))
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(mockGet).toHaveBeenCalledWith('/tasks', expect.objectContaining({ params: { q: 'bel', per_page: 5 } }))
  })

  // Leads reuse the candidates endpoint with a fixed phase[]=lead filter.
  it('scopes leads to phase=lead on the candidates endpoint', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    renderHook(() => useKoiosEntitySearch('leads', 'ah'))
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith('/candidates', expect.objectContaining({
      params: { search: 'ah', per_page: 5, phase: ['lead'] },
    }))
  })

  // A failed request degrades to an empty list, never an uncaught rejection.
  it('resolves to an empty list on a failed request', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useKoiosEntitySearch('customers', 'zorg'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.results).toEqual([])
  })

  // Results are capped at 5 client-side (the workflows endpoint has no per_page cap server-side).
  it('caps results at 5 even when the endpoint returns more', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: `w${i}`, name: `Workflow ${i}` }))
    mockGet.mockResolvedValue({ data: { data: rows } })
    const { result } = renderHook(() => useKoiosEntitySearch('aiagents', 'flow'))
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0))
    expect(result.current.results).toHaveLength(5)
  })
})
