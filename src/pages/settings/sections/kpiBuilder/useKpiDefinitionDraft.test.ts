import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKpiDefinitionDraft } from './useKpiDefinitionDraft'
import type { KpiDefinition, KpiEntityRegistry } from './kpiDefinitionsApi'

const registry: KpiEntityRegistry = {
  metrics: [
    { key: 'new_in_period', label: 'New in period', kind: 'count', default_unit: 'count' },
    { key: 'time_to_hire', label: 'Time to hire', kind: 'avg_workdays', default_unit: 'workdays' },
  ],
  dimensions: ['all', 'application_stage'],
}

const baseRow: KpiDefinition = {
  id: 'kd-1', entity: 'match', metric_key: 'new_in_period', dimension: 'all', dimension_value: null,
  label: 'My KPI', target_value: 15, warn_value: null, comparison: 'gte', unit: 'count',
  surfaces: ['report'], dashboard_roles: null, active: true, sort_order: 0,
}

describe('useKpiDefinitionDraft', () => {
  it('unit follows the picked metric default_unit', () => {
    const { result } = renderHook(() => useKpiDefinitionDraft(registry, null))
    act(() => result.current.setField('metric_key', 'time_to_hire'))
    expect(result.current.draft.unit).toBe('workdays')
  })

  it('a manual unit override sticks until the metric changes again', () => {
    const { result } = renderHook(() => useKpiDefinitionDraft(registry, null))
    act(() => result.current.setField('metric_key', 'time_to_hire'))
    act(() => result.current.setField('unit', 'months'))
    expect(result.current.draft.unit).toBe('months')
    act(() => result.current.setField('metric_key', 'new_in_period'))
    expect(result.current.draft.unit).toBe('count')
  })

  it('dimension_value resets when the dimension changes', () => {
    const { result } = renderHook(() => useKpiDefinitionDraft(registry, null))
    act(() => result.current.setField('dimension', 'application_stage'))
    act(() => result.current.setField('dimension_value', 'invited'))
    expect(result.current.draft.dimension_value).toBe('invited')
    act(() => result.current.setField('dimension', 'all'))
    expect(result.current.draft.dimension_value).toBeNull()
  })

  it('changedKeys reports only the differing keys', () => {
    const { result } = renderHook(() => useKpiDefinitionDraft(registry, baseRow))
    act(() => result.current.setField('target_value', 20))
    expect(result.current.changedKeys(baseRow)).toEqual({ target_value: 20 })
  })

  it('changedKeys is empty when nothing changed', () => {
    const { result } = renderHook(() => useKpiDefinitionDraft(registry, baseRow))
    expect(result.current.changedKeys(baseRow)).toEqual({})
  })

  it('an empty label trims to null in the create body', () => {
    const { result } = renderHook(() => useKpiDefinitionDraft(registry, null))
    act(() => result.current.setField('metric_key', 'new_in_period'))
    act(() => result.current.setField('label', '   '))
    expect(result.current.createBody().label).toBeNull()
  })
})
