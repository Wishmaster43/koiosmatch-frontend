/**
 * kpiDefinitionsApi — request pins: method/route/body per function, and the
 * unwrap of both the single-resource and list envelope shapes (§13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import api from '@/lib/api'
import {
  fetchKpiMetrics, fetchKpiDefinitions, createKpiDefinition, patchKpiDefinition,
  deleteKpiDefinition, restoreKpiDefinition, putKpiDefinitionsOrder,
} from './kpiDefinitionsApi'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() } }
})

beforeEach(() => vi.clearAllMocks())

describe('fetchKpiMetrics', () => {
  it('GETs /kpi-metrics and unwraps the registry', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { match: { metrics: [], dimensions: ['all'] } } } } as never)
    const registry = await fetchKpiMetrics()
    expect(api.get).toHaveBeenCalledWith('/kpi-metrics', { signal: undefined })
    expect(registry).toEqual({ match: { metrics: [], dimensions: ['all'] } })
  })

  it('falls back to {} on an empty payload', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: {} } as never)
    expect(await fetchKpiMetrics()).toEqual({})
  })
})

describe('fetchKpiDefinitions', () => {
  it('GETs /kpi-definitions with the entity param and unwraps rows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [{ id: 'a' }] } } as never)
    const rows = await fetchKpiDefinitions({ entity: 'task' })
    expect(api.get).toHaveBeenCalledWith('/kpi-definitions', { params: { entity: 'task' }, signal: undefined })
    expect(rows).toEqual([{ id: 'a' }])
  })
})

describe('createKpiDefinition', () => {
  it('POSTs the exact body', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'kd-1' } } } as never)
    const body = {
      entity: 'match' as const, metric_key: 'new_in_period', unit: 'count' as const,
      dimension: 'all', dimension_value: null, label: null, target_value: 15,
      warn_value: null, comparison: 'none' as const, surfaces: ['report' as const], active: true,
    }
    const row = await createKpiDefinition(body)
    expect(api.post).toHaveBeenCalledWith('/kpi-definitions', body)
    expect(row).toEqual({ id: 'kd-1' })
  })
})

describe('patchKpiDefinition', () => {
  it('PATCHes only the changed key', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { data: { id: 'kd-1', target_value: 15 } } } as never)
    await patchKpiDefinition('kd-1', { target_value: 15 })
    expect(api.patch).toHaveBeenCalledWith('/kpi-definitions/kd-1', { target_value: 15 })
  })
})

describe('deleteKpiDefinition', () => {
  it('DELETEs the per-id route', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: {} } as never)
    await deleteKpiDefinition('kd-1')
    expect(api.delete).toHaveBeenCalledWith('/kpi-definitions/kd-1')
  })
})

describe('restoreKpiDefinition', () => {
  it('POSTs the restore route', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { id: 'kd-1' } } } as never)
    await restoreKpiDefinition('kd-1')
    expect(api.post).toHaveBeenCalledWith('/kpi-definitions/kd-1/restore')
  })
})

describe('putKpiDefinitionsOrder', () => {
  it('PUTs the ids body', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} } as never)
    await putKpiDefinitionsOrder(['a', 'b'])
    expect(api.put).toHaveBeenCalledWith('/kpi-definitions/order', { ids: ['a', 'b'] })
  })
})
