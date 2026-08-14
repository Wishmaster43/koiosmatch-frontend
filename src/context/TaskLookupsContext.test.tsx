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
    mockLookups({ '/task-types': [{ value: 'call', label: 'Belafspraak', color: '#5FB0AC', icon: '📞' }] })
    const { result } = renderHook(() => useTaskLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.types.find(t => t.value === 'call')?.icon).toBe('📞')
  })

  it('leaves icon undefined when the API omits it, never fabricating one', async () => {
    mockLookups({ '/task-types': [{ value: 'task', label: 'Taak', color: '#6E8FD6' }] })
    const { result } = renderHook(() => useTaskLookups(), { wrapper })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.types.find(t => t.value === 'task')?.icon).toBeUndefined()
  })
})
