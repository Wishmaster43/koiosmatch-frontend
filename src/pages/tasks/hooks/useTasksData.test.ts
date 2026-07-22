/**
 * useTasksData — regression tests for the re-audit findings: a network/timeout
 * failure (no response object) must surface as the error state, not the empty
 * state, and the archived (?archived=1) fetch must signal its own failure
 * instead of silently collapsing to "no archived tasks" (§13: a red flow is a
 * real finding, tests assert the actual state the hook returns).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTasksData } from './useTasksData'
import api from '@/lib/api'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})
const mockedGet = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

// Minimal lookup stubs — the label/colour resolution itself is out of scope here.
const lookupProps = {
  statuses: [], priorities: [], types: [],
  statusMeta: () => ({ value: '', label: '', color: '#000' }),
  priorityMeta: () => ({ value: '', label: '', color: '#000' }),
  typeMeta: () => ({ value: '', label: '', color: '#000' }),
  doneStatusValues: [],
}

describe('useTasksData · error signalling (re-audit findings)', () => {
  it('sets error on a network/timeout failure with no response object', async () => {
    // Axios network/timeout errors carry no `response` at all.
    mockedGet.mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useTasksData({ showArchived: false, ...lookupProps }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('sets error on a 500 response', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500 } })
    const { result } = renderHook(() => useTasksData({ showArchived: false, ...lookupProps }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(true)
  })

  it('treats a 404 as "not built yet" — empty, not an error', async () => {
    mockedGet.mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useTasksData({ showArchived: false, ...lookupProps }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(false)
    expect(result.current.all).toEqual([])
  })

  it('signals archivedError on a failed archived fetch instead of reading as "no archived tasks"', async () => {
    mockedGet.mockImplementation((_url: string, config?: { params?: Record<string, unknown> }) => {
      if (config?.params?.archived) return Promise.reject({ response: { status: 500 } })
      return Promise.resolve({ data: { data: [] } })
    })
    const { result } = renderHook(() => useTasksData({ showArchived: true, ...lookupProps }))
    await waitFor(() => expect(result.current.archivedError).toBe(true))
    // The view-relevant `error` (what TasksPage forwards to TasksTable) reflects
    // the archived toggle's own failure, not the (unrelated) main-list state.
    expect(result.current.error).toBe(true)
    expect(result.current.archivedTasks).toEqual([])
  })

  it('does not report archivedError once the archived list loads successfully', async () => {
    mockedGet.mockImplementation((_url: string, config?: { params?: Record<string, unknown> }) => {
      if (config?.params?.archived) return Promise.resolve({ data: { data: [{ id: 'a1', title: 'Old task' }] } })
      return Promise.resolve({ data: { data: [] } })
    })
    const { result } = renderHook(() => useTasksData({ showArchived: true, ...lookupProps }))
    await waitFor(() => expect(result.current.archivedTasks).toHaveLength(1))
    expect(result.current.archivedError).toBe(false)
    expect(result.current.error).toBe(false)
  })
})
