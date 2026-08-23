import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useKoiosMultiEntitySearch } from './useKoiosMultiEntitySearch'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockGet = api.get as unknown as ReturnType<typeof vi.fn>

describe('useKoiosMultiEntitySearch', () => {
  beforeEach(() => { mockGet.mockReset(); vi.useRealTimers() })

  // Below the 2-char threshold, never touches the API for any category.
  it('stays empty and never calls the API below the minimum query length', async () => {
    const { result } = renderHook(() => useKoiosMultiEntitySearch(['candidates', 'vacancies'], 'a'))
    await new Promise((r) => setTimeout(r, 260))
    expect(result.current.groups).toEqual({})
    expect(mockGet).not.toHaveBeenCalled()
  })

  // One request PER visible category, each with the typed query.
  it('issues one request per category with the typed query', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    renderHook(() => useKoiosMultiEntitySearch(['candidates', 'vacancies', 'tasks'], 'jan'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(mockGet).toHaveBeenCalledWith('/candidates', expect.objectContaining({ params: { search: 'jan', per_page: 5 } }))
    expect(mockGet).toHaveBeenCalledWith('/vacancies', expect.objectContaining({ params: { search: 'jan', per_page: 5 } }))
    expect(mockGet).toHaveBeenCalledWith('/tasks', expect.objectContaining({ params: { q: 'jan', per_page: 5 } }))
  })

  // Groups render independently — each category's own results land under its own key.
  it('resolves each category to its own group', async () => {
    mockGet.mockImplementation((url: string) => url === '/candidates'
      ? Promise.resolve({ data: { data: [{ id: 'c1', name: 'Ahmed Vos' }] } })
      : Promise.resolve({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } }))
    const { result } = renderHook(() => useKoiosMultiEntitySearch(['candidates', 'vacancies'], 'ah'))
    await waitFor(() => expect(result.current.groups.candidates?.results).toHaveLength(1))
    expect(result.current.groups.candidates?.results[0]).toEqual({ id: 'c1', name: 'Ahmed Vos', subtitle: '' })
    expect(result.current.groups.vacancies?.results).toHaveLength(1)
    expect(result.current.groups.vacancies?.results[0].name).toBe('Verpleegkundige')
  })

  // Cap applies per category, mirrors the single-category hook.
  it('caps each group at 5 even when the endpoint returns more', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Klant ${i}` }))
    mockGet.mockResolvedValue({ data: { data: rows } })
    const { result } = renderHook(() => useKoiosMultiEntitySearch(['customers'], 'zorg'))
    await waitFor(() => expect(result.current.groups.customers?.results.length).toBeGreaterThan(0))
    expect(result.current.groups.customers?.results).toHaveLength(5)
  })

  // A failing category degrades to an empty group WITHOUT sinking the others,
  // but it must flag its OWN `error: true` — never a silent empty group.
  it('a failing category does not sink the others and flags its own error', async () => {
    mockGet.mockImplementation((url: string) => url === '/vacancies'
      ? Promise.reject(new Error('boom'))
      : Promise.resolve({ data: { data: [{ id: 'c1', name: 'Ahmed Vos' }] } }))
    const { result } = renderHook(() => useKoiosMultiEntitySearch(['candidates', 'vacancies'], 'ah'))
    await waitFor(() => expect(result.current.groups.candidates?.results).toHaveLength(1))
    await waitFor(() => expect(result.current.groups.vacancies?.loading).toBe(false))
    expect(result.current.groups.vacancies?.results).toEqual([])
    expect(result.current.groups.vacancies?.error).toBe(true)
    expect(result.current.groups.candidates?.error).toBe(false)
  })

  // retry() re-fires the whole batch — a single "try again" recovers every
  // failed group at once.
  it('retry() re-fires the batch and can recover a failed group', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useKoiosMultiEntitySearch(['vacancies'], 'ah'))
    await waitFor(() => expect(result.current.groups.vacancies?.error).toBe(true))
    mockGet.mockResolvedValueOnce({ data: { data: [{ id: 'v1', title: 'Verpleegkundige' }] } })
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.groups.vacancies?.results).toHaveLength(1))
    expect(result.current.groups.vacancies?.error).toBe(false)
  })

  // Re-firing with a different category set clears the previous batch's state.
  it('resets state when the category list becomes empty', async () => {
    mockGet.mockResolvedValue({ data: { data: [{ id: 'c1', name: 'Ahmed Vos' }] } })
    const { result, rerender } = renderHook(
      ({ ids, q }: { ids: string[]; q: string }) => useKoiosMultiEntitySearch(ids, q),
      { initialProps: { ids: ['candidates'], q: 'ah' } },
    )
    await waitFor(() => expect(result.current.groups.candidates?.results).toHaveLength(1))
    rerender({ ids: [], q: 'ah' })
    expect(result.current.groups).toEqual({})
  })

  // The whole-list flash fix: a group only flips to `loading` once the
  // debounce actually fires — mid-debounce, the previous batch's state
  // (here: nothing yet) is left untouched instead of being wiped early.
  it('does not mark groups loading before the debounce fires', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useKoiosMultiEntitySearch(['candidates'], 'ah'))
    // Immediately after mount (well before the 250ms debounce), nothing has
    // been marked loading yet — the group is simply absent, not a wiped list.
    expect(result.current.groups.candidates).toBeUndefined()
    await waitFor(() => expect(result.current.groups.candidates?.loading).toBe(false))
  })
})
