/**
 * useNoteFeed — request pin (NOTITIE-DOORLINK-1 read side, commit 1d71ce3f):
 * asserts the exact route + query params, and that pagination accumulates
 * pages via `loadMore` rather than replacing them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import api from '@/lib/api'
import { useNoteFeed } from './useNoteFeed'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn() } }
})

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children)

beforeEach(() => vi.clearAllMocks())

describe('useNoteFeed', () => {
  it('GETs the exact route with only_linked/per_page/page pinned', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 } } as never)
    renderHook(() => useNoteFeed('candidates', 'c1', true), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/candidates/c1/note-feed')
    expect(config?.params).toEqual({ only_linked: 1, per_page: 25, page: 1 })
  })

  it('omits only_linked when the caller wants the full feed', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 } } as never)
    renderHook(() => useNoteFeed('customers', 'cu1', false), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url, config] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/customers/cu1/note-feed')
    expect(config?.params).not.toHaveProperty('only_linked')
    expect(config?.params).toMatchObject({ per_page: 25, page: 1 })
  })

  it('nests the sub-entity route under the owning customer (CMBE 64d976ff)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [], current_page: 1, last_page: 1, total: 0, per_page: 25 } } as never)
    renderHook(() => useNoteFeed('customers', 'cu1', true, { kind: 'locations', id: 'loc9' }), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    const [url] = vi.mocked(api.get).mock.calls[0]
    expect(url).toBe('/customers/cu1/locations/loc9/note-feed')
  })

  it('does not fetch while id is null/undefined', () => {
    renderHook(() => useNoteFeed('candidates', undefined, false), { wrapper })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('accumulates pages on loadMore and exposes hasMore from the paginator meta', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ id: 'n1', note_type: 'application_note', source: { type: 'application', id: 'a1', label: 'Sollicitatie · Jan', deleted: false }, body: 'x', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', is_direct: false, principals: [] }], current_page: 1, last_page: 2, total: 2, per_page: 1 },
    } as never)
    const { result } = renderHook(() => useNoteFeed('candidates', 'c1', true), { wrapper })
    await waitFor(() => expect(result.current.items.length).toBe(1))
    expect(result.current.hasMore).toBe(true)

    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: [{ id: 'n2', note_type: 'match_note', source: { type: 'match', id: 'm1', label: 'Match · Jan', deleted: false }, body: 'y', type: 'general', author: 'Kelly', language: null, created_at: '2026-08-02T10:00:00Z', updated_at: '2026-08-02T10:00:00Z', is_direct: false, principals: [] }], current_page: 2, last_page: 2, total: 2, per_page: 1 },
    } as never)
    await act(async () => { result.current.loadMore() })
    await waitFor(() => expect(result.current.items.length).toBe(2))
    expect(result.current.hasMore).toBe(false)
    const [, secondConfig] = vi.mocked(api.get).mock.calls[1]
    expect(secondConfig?.params).toEqual({ only_linked: 1, per_page: 25, page: 2 })
  })
})
