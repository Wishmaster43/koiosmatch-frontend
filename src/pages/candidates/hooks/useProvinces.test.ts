/**
 * useProvinces — country cascade (Danny addendum, kandidaten-ronde-2): the
 * province lookup now scopes to the candidate's own address `country`. Asserts
 * the actual GET request (with the country param embedded in the URL, so it
 * also doubles as the cache key) rather than only that data loaded — a caller
 * that drops the scope would otherwise silently show the wrong country's list.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useProvinces } from './useProvinces'

// Keep the real unwrap/lookupNames helpers — only the default client is stubbed.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('useProvinces — country cascade', () => {
  it('defaults to /provinces?country=NL, and normalizes an empty country to the same cache slot', async () => {
    mockedGet.mockResolvedValue({ data: ['Utrecht'] })
    const { result: r1 } = renderHook(() => useProvinces())
    await waitFor(() => expect(r1.current.provinces).toEqual(['Utrecht']))
    expect(mockedGet).toHaveBeenCalledWith('/provinces?country=NL', undefined)
    expect(mockedGet).toHaveBeenCalledTimes(1)

    // An explicit '' arg (e.g. a candidate with no country picked yet) hits the
    // SAME cache slot — no second request, no separate "empty country" bucket.
    const { result: r2 } = renderHook(() => useProvinces(''))
    await waitFor(() => expect(r2.current.provinces).toEqual(['Utrecht']))
    expect(mockedGet).toHaveBeenCalledTimes(1)
  })

  it('scopes the request to the picked country, never reusing another country\'s cached list', async () => {
    mockedGet.mockResolvedValue({ data: ['Antwerpen'] })
    const { result } = renderHook(() => useProvinces('BE'))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/provinces?country=BE', undefined))
    await waitFor(() => expect(result.current.provinces).toEqual(['Antwerpen']))
  })

  it('shows an empty list — not a stale seed — for a country with no seeded provinces', async () => {
    mockedGet.mockResolvedValue({ data: [] })
    const { result } = renderHook(() => useProvinces('FR'))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/provinces?country=FR', undefined))
    await waitFor(() => expect(result.current.provinces).toEqual([]))
  })
})
