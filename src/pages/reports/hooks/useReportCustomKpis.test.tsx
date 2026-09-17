/**
 * useReportCustomKpis — wiring test. Asserts the definition-drill param
 * mapping (phase_filter dropped, customer_id renamed to customer_ids), the
 * active-id derivation from the open drill's route, and that the shared
 * factory/mapping hooks receive what the report pages relied on before the
 * CUSTOM-KPI-HOOK-1 extraction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { CustomKpiCard } from '@/types/analytics'
import { useReportCustomKpis } from './useReportCustomKpis'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const mockMakeOpenCustomKpiDrill = vi.fn((opts: unknown) => ({ __opts: opts }))
vi.mock('../lib/drillFactories', () => ({
  makeOpenCustomKpiDrill: (opts: unknown) => mockMakeOpenCustomKpiDrill(opts),
}))

const mockUseCustomKpiCards = vi.fn()
vi.mock('./useCustomKpiCards', () => ({
  useCustomKpiCards: (opts: unknown) => mockUseCustomKpiCards(opts),
}))

const card: CustomKpiCard = {
  id: 'kd-1', entity: 'match', metric_key: 'new_in_period', label: 'Nieuwe matches',
  dimension: 'all', dimension_value: null, dimension_label: null,
  value: 14, unit: 'count', target: null, warn: null, comparison: 'gte', status: 'ok',
}

describe('useReportCustomKpis', () => {
  beforeEach(() => {
    mockMakeOpenCustomKpiDrill.mockClear()
    mockUseCustomKpiCards.mockReset().mockReturnValue([])
  })

  it('drops phase_filter and passes other params through unchanged', () => {
    const setDrill = vi.fn()
    const windowSub = () => 'window'
    renderHook(() => useReportCustomKpis({
      data: { custom_kpis: [card] },
      drill: null,
      baseParams: { status: 'open', phase_filter: ['lead'] },
      windowSub,
      setDrill,
      entityPage: 'candidates',
    }))
    expect(mockMakeOpenCustomKpiDrill).toHaveBeenCalledWith({
      baseParams: { status: 'open' },
      windowSub,
      setDrill,
      entityPage: 'candidates',
    })
  })

  it('renames customer_id to customer_ids for the definition-drill route', () => {
    const setDrill = vi.fn()
    renderHook(() => useReportCustomKpis({
      data: { custom_kpis: [] },
      drill: null,
      baseParams: { customer_id: ['c-1', 'c-2'], status: 'open' },
      windowSub: () => 'window',
      setDrill,
    }))
    expect(mockMakeOpenCustomKpiDrill).toHaveBeenCalledWith(expect.objectContaining({
      baseParams: { status: 'open', customer_ids: ['c-1', 'c-2'] },
    }))
  })

  it('is idempotent for a page with neither key', () => {
    const setDrill = vi.fn()
    renderHook(() => useReportCustomKpis({
      data: { custom_kpis: [] },
      drill: null,
      baseParams: { status: 'open' },
      windowSub: () => 'window',
      setDrill,
    }))
    expect(mockMakeOpenCustomKpiDrill).toHaveBeenCalledWith(expect.objectContaining({
      baseParams: { status: 'open' },
    }))
  })

  it('derives the active id from the open drill route', () => {
    renderHook(() => useReportCustomKpis({
      data: { custom_kpis: [card] },
      drill: { rowsEndpoint: '/reports/kpi-definitions/kd-1/drill' } as never,
      baseParams: {},
      windowSub: () => 'window',
      setDrill: vi.fn(),
    }))
    expect(mockUseCustomKpiCards).toHaveBeenCalledWith(expect.objectContaining({
      cards: [card], activeId: 'kd-1',
    }))
  })

  it('returns the translated band title and no-onClick cards are untouched', () => {
    const cards = [{ key: 'custom:kd-1', label: 'x', value: '1' }]
    mockUseCustomKpiCards.mockReturnValue(cards)
    const { result } = renderHook(() => useReportCustomKpis({
      data: null, drill: null, baseParams: {}, windowSub: () => 'window', setDrill: vi.fn(),
    }))
    expect(result.current.extraTitle).toBe('customKpi.bandTitle')
    expect(result.current.customKpis).toBe(cards)
    expect(result.current.customKpis[0]).not.toHaveProperty('onClick')
  })
})
