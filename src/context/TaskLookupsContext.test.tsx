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

afterEach(() => vi.clearAllMocks())

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
