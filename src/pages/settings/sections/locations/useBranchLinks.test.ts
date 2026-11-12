/** useBranchLinks: GET params per branch, PUT body per system, state from the PUT response, nothing fetched when disabled. */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import api from '@/lib/api'
import { useBranchLinks } from './useBranchLinks'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
const mocked = vi.mocked(api, true)
afterEach(() => vi.clearAllMocks())

const row = { hf_id: 'g1', hf_status: 'linked', hf_error: null, sm_id: null, sm_status: null, sm_error: null }
// One fresh QueryClient per test, shared by every render of that test.
let client: QueryClient
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false } } }) })
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)

describe('useBranchLinks', () => {
  it('fetches nothing when disabled and reports no loading', () => {
    const { result } = renderHook(() => useBranchLinks(['b1'], false), { wrapper })
    expect(mocked.get).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('reads GET /external-id-mappings with entity params per branch', async () => {
    mocked.get.mockResolvedValue({ data: { data: row } })
    const ids = ['b1', 'b2']
    const { result } = renderHook(() => useBranchLinks(ids, true), { wrapper })
    await waitFor(() => expect(result.current.get('b1').hf.id).toBe('g1'))
    expect(mocked.get).toHaveBeenCalledWith('/external-id-mappings', expect.objectContaining({ params: { entity_type: 'branch', entity_id: 'b1' } }))
    expect(mocked.get).toHaveBeenCalledWith('/external-id-mappings', expect.objectContaining({ params: { entity_type: 'branch', entity_id: 'b2' } }))
    expect(result.current.get('b1').sm.id).toBeNull()
  })

  it('saves hf_id and sm_id through PUT /external-id-mappings', async () => {
    mocked.get.mockResolvedValue({ data: { data: row } })
    mocked.put.mockResolvedValue({ data: {} })
    const ids = ['b1']
    const { result } = renderHook(() => useBranchLinks(ids, true), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => { await result.current.save('b1', 'hf', 'new-guid') })
    expect(mocked.put).toHaveBeenCalledWith('/external-id-mappings', { entity_type: 'branch', entity_id: 'b1', hf_id: 'new-guid' })
    await act(async () => { await result.current.save('b1', 'sm', null) })
    expect(mocked.put).toHaveBeenCalledWith('/external-id-mappings', { entity_type: 'branch', entity_id: 'b1', sm_id: null })
  })

  it('takes the state after a save from the PUT response, with no extra GET', async () => {
    mocked.get.mockResolvedValue({ data: { data: row } })
    mocked.put.mockResolvedValue({ data: { data: { ...row, hf_id: 'saved', hf_status: 'linked' } } })
    const ids = ['b1']
    const { result } = renderHook(() => useBranchLinks(ids, true), { wrapper })
    await waitFor(() => expect(result.current.get('b1').hf.id).toBe('g1'))
    mocked.get.mockClear()
    await act(async () => { await result.current.save('b1', 'hf', 'saved') })
    await waitFor(() => expect(result.current.get('b1').hf.id).toBe('saved'))
    expect(mocked.get).not.toHaveBeenCalled()
  })

  it('exposes an error flag when the read fails', async () => {
    mocked.get.mockRejectedValue(new Error('boom'))
    const ids = ['b1']
    const { result } = renderHook(() => useBranchLinks(ids, true), { wrapper })
    await waitFor(() => expect(result.current.error).toBe(true))
    expect(result.current.loading).toBe(false)
  })
})
