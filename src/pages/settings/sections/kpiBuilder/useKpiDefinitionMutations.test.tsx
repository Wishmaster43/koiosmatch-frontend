/**
 * useKpiDefinitionMutations — request bodies per write, cache invalidation of
 * the `['kpi-definitions']` prefix, and the optimistic reorder's revert on a
 * rejected PUT (§13: request-asserting, not just "the callback fired").
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import { useKpiDefinitionMutations } from './useKpiDefinitionMutations'
import type { KpiDefinition } from './kpiDefinitionsApi'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() } }
})

afterEach(() => vi.clearAllMocks())

const t = ((key: string) => key) as never

const row = (over: Partial<KpiDefinition> = {}): KpiDefinition => ({
  id: 'kd-1', entity: 'match', metric_key: 'new_in_period', dimension: 'all',
  dimension_value: null, label: null, target_value: null, warn_value: null,
  comparison: 'none', unit: 'count', surfaces: ['report'], dashboard_roles: null,
  active: true, sort_order: 0, ...over,
})

// Fresh QueryClient per test, pre-seeded with the entity's cached list so the
// invalidation/reorder assertions have something real to act on.
function makeClient(rows: KpiDefinition[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['kpi-definitions', 'match'], rows)
  return client
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

describe('useKpiDefinitionMutations', () => {
  it('create POSTs the body and invalidates the kpi-definitions prefix', async () => {
    const client = makeClient([row()])
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: row({ id: 'kd-2' }) } } as never)
    const { result } = renderHook(() => useKpiDefinitionMutations('match', t), { wrapper: wrapperFor(client) })

    const body = { entity: 'match' as const, metric_key: 'new_in_period', unit: 'count' as const, dimension: 'all' }
    await act(async () => { await result.current.create.mutateAsync(body) })

    expect(api.post).toHaveBeenCalledWith('/kpi-definitions', body)
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('patch sends only the changed key', async () => {
    const client = makeClient([row()])
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: row({ target_value: 20 }) } } as never)
    const { result } = renderHook(() => useKpiDefinitionMutations('match', t), { wrapper: wrapperFor(client) })

    await act(async () => { await result.current.patch.mutateAsync({ id: 'kd-1', body: { target_value: 20 } }) })

    expect(api.patch).toHaveBeenCalledWith('/kpi-definitions/kd-1', { target_value: 20 })
  })

  it('remove DELETEs the per-id route, restore POSTs the restore route', async () => {
    const client = makeClient([row()])
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} } as never)
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: row() } } as never)
    const { result } = renderHook(() => useKpiDefinitionMutations('match', t), { wrapper: wrapperFor(client) })

    await act(async () => { await result.current.remove.mutateAsync('kd-1') })
    expect(api.delete).toHaveBeenCalledWith('/kpi-definitions/kd-1')

    await act(async () => { await result.current.restore.mutateAsync('kd-1') })
    expect(api.post).toHaveBeenCalledWith('/kpi-definitions/kd-1/restore')
  })

  it('reorder optimistically writes the new order and PUTs the ids', async () => {
    const client = makeClient([row({ id: 'a' }), row({ id: 'b' })])
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} } as never)
    const { result } = renderHook(() => useKpiDefinitionMutations('match', t), { wrapper: wrapperFor(client) })

    act(() => { result.current.reorder.mutate(['b', 'a']) })

    await waitFor(() => {
      const cached = client.getQueryData<KpiDefinition[]>(['kpi-definitions', 'match'])
      expect(cached?.map(r => r.id)).toEqual(['b', 'a'])
    })
    expect(api.put).toHaveBeenCalledWith('/kpi-definitions/order', { ids: ['b', 'a'] })
  })

  it('reorder reverts the cache to its pre-drag order on a rejected PUT', async () => {
    const client = makeClient([row({ id: 'a' }), row({ id: 'b' })])
    vi.mocked(api.put).mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useKpiDefinitionMutations('match', t), { wrapper: wrapperFor(client) })

    act(() => { result.current.reorder.mutate(['b', 'a']) })

    await waitFor(() => expect(result.current.reorder.isError).toBe(true))
    const cached = client.getQueryData<KpiDefinition[]>(['kpi-definitions', 'match'])
    expect(cached?.map(r => r.id)).toEqual(['a', 'b'])
  })
})
