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

/**
 * NUMMER-1 — typing a reference number (T-00042) must reach the server as an exact
 * `?ref=` lookup, not stay a client-side text filter over the first page. These
 * assert the REQUEST (route + params), because that is the seam: TaskQuery returns
 * early on `ref`, so a dropped param silently degrades to "search the loaded page".
 */
describe('useTasksData · reference-number lookup (NUMMER-1)', () => {
  // Guard (passes before and after the change): the plain list must never carry a ref.
  it('sends no ref without a reference query — the plain list request is unchanged', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useTasksData({ showArchived: false, ...lookupProps }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const call = mockedGet.mock.calls.find(c => c[0] === '/tasks')
    expect((call?.[1] as { params?: Record<string, unknown> })?.params?.ref).toBeUndefined()
  })

  it('sends ?ref= on the active list when the search box holds a reference number', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useTasksData({ showArchived: false, refQuery: 'T-00042', ...lookupProps }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const call = mockedGet.mock.calls.find(c => c[0] === '/tasks')
    expect(call?.[1]?.params).toEqual({ ref: 'T-00042' })
  })

  it('rides ?ref= alongside archived=1 so an archived task is findable by its number too', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result } = renderHook(() => useTasksData({ showArchived: true, refQuery: 'T-00042', ...lookupProps }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const archivedCall = mockedGet.mock.calls.find(c => (c[1] as { params?: Record<string, unknown> })?.params?.archived)
    expect(archivedCall?.[1]?.params).toEqual({ archived: 1, ref: 'T-00042' })
  })

  it('refetches when the reference query changes and again when it is cleared', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } })
    const { result, rerender } = renderHook(
      ({ ref }: { ref: string | null }) => useTasksData({ showArchived: false, refQuery: ref, ...lookupProps }),
      { initialProps: { ref: null as string | null } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ ref: 'T-00042' })
    await waitFor(() => expect(mockedGet.mock.calls.some(c => (c[1] as { params?: Record<string, unknown> })?.params?.ref === 'T-00042')).toBe(true))

    // Clearing the box must go back to the full list — a stale one-row result would
    // read as "there is only one task" (a fake empty state). mockClear first, so the
    // assertion can only be satisfied by a NEW, ref-less request.
    mockedGet.mockClear()
    rerender({ ref: null })
    await waitFor(() => expect(mockedGet.mock.calls.some(
      c => c[0] === '/tasks' && (c[1] as { params?: Record<string, unknown> })?.params?.ref === undefined,
    )).toBe(true))
  })

  it('maps the reference number through so the table column can render it', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 't1', title: 'Bellen', reference_number: 'T-00042' }] } })
    const { result } = renderHook(() => useTasksData({ showArchived: false, refQuery: 'T-00042', ...lookupProps }))
    await waitFor(() => expect(result.current.all).toHaveLength(1))
    expect(result.current.all[0].referenceNumber).toBe('T-00042')
  })
})
