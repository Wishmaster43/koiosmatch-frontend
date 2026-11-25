import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useLookupOptions } from './useLookupOptions'

// Partial mock: only the transport is faked; unwrap/unwrapList stay the REAL helpers
// (mirrors lookupSelectValueKey.test.tsx's own convention).
vi.mock('@/lib/api', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  default: { get: vi.fn() },
}))

describe('useLookupOptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps a plain list response through mapRow, dropping rows the mapper rejects', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.get).mockResolvedValueOnce({ data: [{ id: 1, name: 'A' }, { id: '', name: 'B' }] })
    const { result } = renderHook(() => useLookupOptions('/x', o => (o.id ? { value: String(o.id), label: String(o.name) } : null)))
    await waitFor(() => expect(result.current.opts).toEqual([{ value: '1', label: 'A' }]))
    expect(result.current.error).toBe(false)
  })

  it('reads a named collection out of an object-of-collections response via responseKey', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.get).mockResolvedValueOnce({ data: { statuses: [{ id: 2, name: 'Active' }] } })
    const { result } = renderHook(() => useLookupOptions('/settings/lookups', o => ({ value: String(o.id), label: String(o.name) }), [], 'statuses'))
    await waitFor(() => expect(result.current.opts).toEqual([{ value: '2', label: 'Active' }]))
  })

  it("flattens every group array of an object response when responseKey is '*'", async () => {
    const api = (await import('@/lib/api')).default
    // A non-array value (meta) must be skipped by the flatten, never spread into the options.
    vi.mocked(api.get).mockResolvedValueOnce({ data: { candidates: [{ name: 'candidates.view' }], tasks: [{ name: 'tasks.view' }, { name: 'tasks.edit' }], meta: { total: 3 } } })
    const { result } = renderHook(() => useLookupOptions('/permissions', o => ({ value: String(o.name), label: String(o.name) }), [], '*'))
    await waitFor(() => expect(result.current.opts.map(o => o.value)).toEqual(['candidates.view', 'tasks.view', 'tasks.edit']))
    expect(api.get).toHaveBeenCalledWith('/permissions')
  })

  it('sets error on a failed fetch and clears it (with a fresh fetch) on retry', async () => {
    const api = (await import('@/lib/api')).default
    vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
    vi.mocked(api.get).mockResolvedValueOnce({ data: [{ id: 5, name: 'ok' }] })
    const { result } = renderHook(() => useLookupOptions('/x', o => ({ value: String(o.id), label: String(o.name) })))
    await waitFor(() => expect(result.current.error).toBe(true))
    result.current.retry()
    await waitFor(() => expect(result.current.error).toBe(false))
    await waitFor(() => expect(result.current.opts).toEqual([{ value: '5', label: 'ok' }]))
  })

  it('never fetches when endpoint is empty', () => {
    const { result } = renderHook(() => useLookupOptions('', o => ({ value: String(o.id), label: '' })))
    expect(result.current.opts).toEqual([])
    expect(result.current.error).toBe(false)
  })
})
