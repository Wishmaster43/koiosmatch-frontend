/**
 * useKpiDimensionValues — one arm per dimension key, plus the `all`/unknown
 * default and a loading passthrough (verifier fix, KPI-BUILDER-FE-1 batch A):
 * `loading` must reflect the underlying lookup, not a hardcoded `false`, so
 * the value picker shows a real loading state instead of reading as "empty".
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKpiDimensionValues } from './useKpiDimensionValues'

// Controlled lookups — each mock exposes only the fields this hook reads.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({
    candidateTypes: [{ value: 'flex', label: 'Flex' }],
    loading: true,
  }),
}))
vi.mock('@/hooks/useApplicationStages', () => ({
  useApplicationStages: () => ({
    stages: [{ value: 'applied', label: 'Applied' }],
  }),
}))
vi.mock('@/lib/useContractTypes', () => ({
  useContractTypes: () => ({
    options: [{ value: 'bepaalde_tijd', label: 'Bepaalde tijd' }],
  }),
}))
vi.mock('@/lib/useCachedLookup', () => ({
  useCachedLookup: () => ({
    data: [{ value: '1', label: 'Intake' }],
    loading: true,
  }),
}))

describe('useKpiDimensionValues', () => {
  it('returns application_stage options, unsupported loading (stages have none)', () => {
    const { result } = renderHook(() => useKpiDimensionValues('task', 'application_stage'))
    expect(result.current).toEqual({
      options: [{ value: 'applied', label: 'Applied' }],
      loading: false,
      supported: true,
    })
  })

  it('returns match_contract_form options with the real candidateTypes loading flag', () => {
    const { result } = renderHook(() => useKpiDimensionValues('match', 'match_contract_form'))
    expect(result.current).toEqual({
      options: [{ value: 'flex', label: 'Flex' }],
      loading: true,
      supported: true,
    })
  })

  it('returns match_contract_type options (R5 open, loading stays false)', () => {
    const { result } = renderHook(() => useKpiDimensionValues('match', 'match_contract_type'))
    expect(result.current).toEqual({
      options: [{ value: 'bepaalde_tijd', label: 'Bepaalde tijd' }],
      loading: false,
      supported: true,
    })
  })

  it('returns task_type options with the real useCachedLookup loading flag', () => {
    const { result } = renderHook(() => useKpiDimensionValues('task', 'task_type'))
    expect(result.current).toEqual({
      options: [{ value: '1', label: 'Intake' }],
      loading: true,
      supported: true,
    })
  })

  it('returns unsupported for "all"', () => {
    const { result } = renderHook(() => useKpiDimensionValues('task', 'all'))
    expect(result.current).toEqual({ options: [], loading: false, supported: false })
  })

  it('returns unsupported for an unknown dimension key', () => {
    const { result } = renderHook(() => useKpiDimensionValues('task', 'bogus'))
    expect(result.current).toEqual({ options: [], loading: false, supported: false })
  })
})
