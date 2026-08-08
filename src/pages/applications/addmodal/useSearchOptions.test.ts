/**
 * useSearchOptions — FIX 2 (P1, measured 08-08): a failed picker search used to
 * collapse every cause into one generic boolean ("search failed"); this pins the
 * honest classification (401/403 → forbidden, 422 → validation, 5xx → server, no
 * response at all → network, anything else → unknown) plus the request/options/
 * retry contract that pre-dates this fix.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useSearchOptions } from './useSearchOptions'
import type { RawPickRow, PickOption } from './types'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

// Minimal mapper — only `value`/`label` matter to these tests.
const mapRow = (row: RawPickRow): PickOption => ({ value: row.id ?? '', label: row.name ?? '' })

describe('useSearchOptions · request contract', () => {
  it('GETs the url with the search query and the shared page size', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } })
    renderHook(() => useSearchOptions('/candidates', mapRow, false))
    // EMPTY-SEARCH-422 (Danny live 08-08): an empty box must NOT send `search` at
    // all — Laravel turned '' into null and the rule rejected it, so every open of
    // the picker showed a validation error before typing.
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/candidates', { params: { per_page: 25 } }))
  })

  it('never fetches while skip is true (locked-vacancy path)', async () => {
    renderHook(() => useSearchOptions('/vacancies', mapRow, true))
    await act(async () => { await Promise.resolve() })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('maps rows into options on a successful search', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'c1', name: 'Piet' }] } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.options).toEqual([{ value: 'c1', label: 'Piet' }]))
    expect(result.current.error).toBeNull()
  })
})

describe('useSearchOptions · error classification (FIX 2)', () => {
  it('classifies a 401 as forbidden', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 401 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('forbidden'))
  })

  it('classifies a 403 as forbidden', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('forbidden'))
  })

  it('classifies a 422 as validation', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 422 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('validation'))
  })

  it('classifies a 500 as server', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('server'))
  })

  it('classifies a 503 as server', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 503 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('server'))
  })

  it('classifies a response-less rejection (no connection) as network', async () => {
    vi.mocked(api.get).mockRejectedValue({ message: 'Network Error' })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('network'))
  })

  it('classifies any other status (e.g. 404) as unknown', async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('unknown'))
  })

  it('clears the error and re-issues the SAME query on retry()', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 500 } })
    const { result } = renderHook(() => useSearchOptions('/candidates', mapRow, false))
    await waitFor(() => expect(result.current.error).toBe('server'))

    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'c1', name: 'Piet' }] } })
    act(() => { result.current.retry() })
    // Wait on the OPTIONS, not on the error: the effect clears the error
    // synchronously on re-run, so an `error === null` wait passes before the
    // retried request has even resolved — and the options assertion then races it.
    await waitFor(() => expect(result.current.options).toEqual([{ value: 'c1', label: 'Piet' }]))
    expect(result.current.error).toBeNull()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('drops a stale rejection when a newer search has already superseded it (freshness guard)', async () => {
    let rejectFirst: (e: unknown) => void = () => {}
    vi.mocked(api.get).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject }))
    const { result, rerender } = renderHook(() => useSearchOptions('/candidates', mapRow, false), { initialProps: { q: '' } })

    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'c2', name: 'Jan' }] } })
    act(() => { result.current.setQuery('jan') })
    rerender({ q: 'jan' })
    await waitFor(() => expect(result.current.options).toEqual([{ value: 'c2', label: 'Jan' }]))

    // The FIRST (now-stale) request finally rejects — must not overwrite the newer success.
    act(() => { rejectFirst({ response: { status: 500 } }) })
    await act(async () => { await Promise.resolve() })
    expect(result.current.error).toBeNull()
    expect(result.current.options).toEqual([{ value: 'c2', label: 'Jan' }])
  })
})
