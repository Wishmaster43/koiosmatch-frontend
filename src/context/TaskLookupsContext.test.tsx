/**
 * TaskLookupsContext — icon pass-through regression (control round 13-08): the
 * task-type/status/priority lookups carry a tenant `icon` (BE task-types R-2,
 * an emoji/string), but normalize() built only value/label/color, silently
 * dropping it before any picker could ever render it. This guards the fix.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import api from '@/lib/api'
import { TaskLookupsProvider, useTaskLookups } from './TaskLookupsContext'
import { clearRecentLookups, setRecentLookupWindow, RECENT_LOOKUP_MS } from './lookupLoader'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api')
  return { ...actual, default: { get: vi.fn() } }
})

const mockedGet = vi.mocked(api.get)

// Answer each lookup endpoint from one map; anything unlisted resolves empty (→ seed).
function mockLookups(byUrl: Record<string, unknown[]>) {
  mockedGet.mockImplementation((url: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the axios response envelope
    Promise.resolve({ data: byUrl[url] ?? [] } as any))
}

const wrapper = ({ children }: { children: ReactNode }) => <TaskLookupsProvider>{children}</TaskLookupsProvider>

afterEach(() => { clearRecentLookups(); setRecentLookupWindow(0); vi.clearAllMocks() })

describe('TaskLookupsContext icon pass-through', () => {
  it('carries the tenant icon through for task types', async () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA fixture: a tenant lookup colour as the server sends it, not a UI colour choice
    mockLookups({ '/task-types': [{ value: 'call', label: 'Belafspraak', color: '#5FB0AC', icon: '📞' }] })
    const { result } = renderHook(() => useTaskLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.types.find(t => t.value === 'call')?.icon).toBe('📞')
  })

  it('leaves icon undefined when the API omits it, never fabricating one', async () => {
    // eslint-disable-next-line no-restricted-syntax -- DATA fixture: a tenant lookup colour as the server sends it, not a UI colour choice
    mockLookups({ '/task-types': [{ value: 'task', label: 'Taak', color: '#6E8FD6' }] })
    const { result } = renderHook(() => useTaskLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.types.find(t => t.value === 'task')?.icon).toBeUndefined()
  })
})

// SEED-IDENTITY-1 (regression, 25-08): the i18n sweep translated the seed labels on
// EVERY render, so `statuses`/`types`/`priorities` were a fresh array each time. The
// tasks page then looped forever — AddTaskModal's effect lists those arrays in its
// dependency array and calls setForm, so a new identity per render meant setState per
// render ("Maximum update depth exceeded", measured on #tasks in a live browser).
// The translated seed must therefore keep a stable identity across re-renders.
describe('TaskLookupsContext seed identity (SEED-IDENTITY-1)', () => {
  it('keeps one array identity across re-renders while on the seed fallback', async () => {
    mockLookups({})
    const { result, rerender } = renderHook(() => useTaskLookups(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const first = { statuses: result.current.statuses, types: result.current.types, priorities: result.current.priorities }
    rerender()
    rerender()

    expect(result.current.statuses).toBe(first.statuses)
    expect(result.current.types).toBe(first.types)
    expect(result.current.priorities).toBe(first.priorities)
  })

  it('keeps one array identity across re-renders on tenant-configured labels too', async () => {
    mockLookups({ '/task-statuses': [{ value: 'open', label: 'Open' }] })
    const { result, rerender } = renderHook(() => useTaskLookups(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    const first = result.current.statuses
    rerender()
    expect(result.current.statuses).toBe(first)
  })
})

// LOOKUP-DEDUPE-1: two providers mounted in the same tick (StrictMode's double
// mount of the same provider, or two consumers of this provider on one page)
// must share ONE in-flight request per lookup URL, not fire one each.
describe('TaskLookupsContext · concurrent-mount dedupe (LOOKUP-DEDUPE-1)', () => {
  it('two providers mounted together request each lookup URL exactly once', async () => {
    mockLookups({
      '/task-statuses': [{ value: 'open', label: 'Open' }],
      '/task-types': [{ value: 'task', label: 'Taak' }],
      '/task-priorities': [{ value: 'normal', label: 'Normaal' }],
    })

    const a = renderHook(() => useTaskLookups(), { wrapper })
    const b = renderHook(() => useTaskLookups(), { wrapper })

    await waitFor(() => expect(a.result.current.loading).toBe(false))
    await waitFor(() => expect(b.result.current.loading).toBe(false))

    expect(mockedGet).toHaveBeenCalledTimes(3) // statuses + types + priorities, once each
  })

  it('a provider mounted after the recent window still refetches (freshness for settings edits)', async () => {
    // LOOKUP-RECENT-1: inside the window a later mount reuses the answer; this case opens the
    // window (closed by default under vitest) and steps past it.
    setRecentLookupWindow(RECENT_LOOKUP_MS)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00Z'))
    mockLookups({
      '/task-statuses': [{ value: 'open', label: 'Open' }],
      '/task-types': [{ value: 'task', label: 'Taak' }],
      '/task-priorities': [{ value: 'normal', label: 'Normaal' }],
    })

    const first = renderHook(() => useTaskLookups(), { wrapper })
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(3)

    vi.setSystemTime(new Date(Date.parse('2026-10-08T10:00:00Z') + RECENT_LOOKUP_MS + 1))
    const second = renderHook(() => useTaskLookups(), { wrapper })
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(6) // a real second round of requests, not a cache hit
    vi.useRealTimers()
  })

  it('a provider mounted inside the recent window reuses the answer without a request', async () => {
    setRecentLookupWindow(RECENT_LOOKUP_MS)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-08T10:00:00Z'))
    mockLookups({ '/task-statuses': [{ value: 'open', label: 'Open' }] })
    const first = renderHook(() => useTaskLookups(), { wrapper })
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    vi.setSystemTime(new Date('2026-10-08T10:00:01Z'))
    const second = renderHook(() => useTaskLookups(), { wrapper })
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(mockedGet).toHaveBeenCalledTimes(3)
    expect(second.result.current.statuses.map(s => s.value)).toContain('open')
    vi.useRealTimers()
  })
})
