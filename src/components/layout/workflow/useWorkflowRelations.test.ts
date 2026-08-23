/**
 * useWorkflowRelations — WF-RELATIONS-FE-1's data hook. Pins the GET route
 * (never a hardcoded/guessed alternative), the four UI states (loading/error/
 * empty/success), and the active-toggle mutation: a MINIMAL `{status, active}`
 * PUT — never the full denormalized payload (that would send `steps: []` and
 * WIPE the related workflow's graph, since this hook never loaded it).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useWorkflowRelations } from './useWorkflowRelations'
import api from '@/lib/api'

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), put: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)
const mockedPut = vi.mocked(api.put)

beforeEach(() => vi.clearAllMocks())

describe('useWorkflowRelations', () => {
  it('pins GET /workflows/{id}/relations and exposes parents + children on success', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [{ id: 'p1', name: 'Ouderflow', status: 'active', runs_count: 3, last_run_at: '2026-08-20T10:00:00Z', last_run_status: 'success' }],
      children: [{ id: 'c1', name: 'Kindflow', status: 'inactive', runs_count: 0 }],
    } })
    const { result } = renderHook(() => useWorkflowRelations('wf-1'))

    expect(mockedGet).toHaveBeenCalledWith('/workflows/wf-1/relations')
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.parents).toEqual([expect.objectContaining({ id: 'p1', name: 'Ouderflow' })])
    expect(result.current.children).toEqual([expect.objectContaining({ id: 'c1', name: 'Kindflow' })])
    expect(result.current.error).toBe(false)
  })

  it('empty tree: both lists resolve empty, no error', async () => {
    mockedGet.mockResolvedValue({ data: { parents: [], children: [] } })
    const { result } = renderHook(() => useWorkflowRelations('wf-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.parents).toEqual([])
    expect(result.current.children).toEqual([])
    expect(result.current.error).toBe(false)
  })

  it('a failed fetch is an honest error, never a silently-empty tree', async () => {
    mockedGet.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useWorkflowRelations('wf-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('toggleStatus PUTs ONLY {status, active} — never the full denormalized payload with steps', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [{ id: 'p1', name: 'Ouderflow', status: 'active' }], children: [],
    } })
    mockedPut.mockResolvedValue({})
    const { result } = renderHook(() => useWorkflowRelations('wf-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggleStatus(result.current.parents[0], 'parents') })

    expect(mockedPut).toHaveBeenCalledWith('/workflows/p1', { status: 'inactive', active: false })
    expect(result.current.parents[0].status).toBe('inactive')
  })

  it('rolls back the optimistic toggle on a failed PUT', async () => {
    mockedGet.mockResolvedValue({ data: {
      parents: [{ id: 'p1', name: 'Ouderflow', status: 'active' }], children: [],
    } })
    mockedPut.mockRejectedValue(new Error('forbidden'))
    const { result } = renderHook(() => useWorkflowRelations('wf-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.toggleStatus(result.current.parents[0], 'parents') })

    expect(result.current.parents[0].status).toBe('active')
  })
})
