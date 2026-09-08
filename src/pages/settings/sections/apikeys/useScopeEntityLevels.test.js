/**
 * useScopeEntityLevels — GET /api-keys/scope-entities → { entity: levels[] }; a failed or
 * missing route leaves the map empty (every level stays offered, today's behaviour).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { useScopeEntityLevels } from './useScopeEntityLevels'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }, unwrap: (r) => r.data?.data ?? r.data, unwrapList: (r) => ({ rows: r.data?.data ?? [] }) }))

describe('useScopeEntityLevels', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('reads the hint from GET /api-keys/scope-entities (data envelope)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ entity: 'candidates', levels: ['read', 'read_write'] }, { entity: 'company', levels: ['read'] }] } })
    const { result } = renderHook(() => useScopeEntityLevels())
    await waitFor(() => expect(result.current.company).toEqual(['read']))
    expect(api.get).toHaveBeenCalledWith('/api-keys/scope-entities')
    expect(result.current.candidates).toEqual(['read', 'read_write'])
  })

  it('accepts a bare array and skips malformed rows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [{ entity: 'users', levels: ['read'] }, { entity: 'x' }, null] })
    const { result } = renderHook(() => useScopeEntityLevels())
    await waitFor(() => expect(result.current.users).toEqual(['read']))
    expect(Object.keys(result.current)).toEqual(['users'])
  })

  it('leaves the map empty when the route fails (no face change without the hint)', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { status: 404 } })
    const { result } = renderHook(() => useScopeEntityLevels())
    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(result.current).toEqual({})
  })
})
