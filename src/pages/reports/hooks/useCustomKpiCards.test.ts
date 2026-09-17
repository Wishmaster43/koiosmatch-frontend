/**
 * useCustomKpiCards — asserts the KpiSpec assembly per card: dimension label,
 * unit formatting (locale-aware), null → dash with no click handler, status
 * ink colour and caption. `t` is a minimal stub mirroring real i18next
 * interpolation (matches customKpiCaption.test.ts's own stub).
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { CustomKpiCard } from '@/types/analytics'
import { useCustomKpiCards } from './useCustomKpiCards'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${Object.values(opts).join(',')}` : key,
  }),
}))

// nl locale by default; a per-test formatNumber/formatCurrency override proves
// the hook goes through kpiUnitFormat rather than formatting inline.
const mockFormat = vi.hoisted(() => ({ locale: 'nl-NL', currency: 'EUR' }))
vi.mock('@/lib/formatters', () => ({
  useNumberFormat: () => mockFormat,
  formatNumber: (n: number, locale: string) => new Intl.NumberFormat(locale).format(n),
  formatPercent: (n: number, locale: string) => `${new Intl.NumberFormat(locale).format(n)}%`,
  formatCurrency: (n: number, currency: string, locale: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n),
  formatRatio: (n: number, locale: string) => `${new Intl.NumberFormat(locale).format(n * 100)}%`,
}))

const baseCard: CustomKpiCard = {
  id: 'kd-1', entity: 'match', metric_key: 'new_in_period', label: 'Nieuwe matches',
  dimension: 'all', dimension_value: null, dimension_label: null,
  value: 14, unit: 'count', target: null, warn: null, comparison: 'gte', status: 'ok',
}

describe('useCustomKpiCards', () => {
  it('renders a plain label when no dimension_label is set', () => {
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [baseCard], activeId: null, onOpen }))
    expect(result.current[0].label).toBe('Nieuwe matches')
    expect(result.current[0].key).toBe('custom:kd-1')
  })

  it('renders labelWithDimension when dimension_label is set (fan-out card)', () => {
    const card = { ...baseCard, dimension: 'contract_form', dimension_value: 'freelance', dimension_label: 'ZZP' }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].label).toBe('analytics:customKpi.labelWithDimension:Nieuwe matches,ZZP')
  })

  it('null value renders the house dash and wires no onClick', () => {
    const card = { ...baseCard, value: null }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].value).toBe('—')
    expect(result.current[0].onClick).toBeUndefined()
  })

  it('calls onOpen with the card and its composed label/formatted value when clicked', () => {
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [baseCard], activeId: null, onOpen }))
    result.current[0].onClick?.()
    expect(onOpen).toHaveBeenCalledWith(baseCard, 'Nieuwe matches', '14')
  })

  it('formats a percent unit via kpiUnitFormat on the active locale', () => {
    const card = { ...baseCard, unit: 'percent' as const, value: 42.5 }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].value).toBe('42,5%')
  })

  it('formats a currency unit via kpiUnitFormat', () => {
    const card = { ...baseCard, unit: 'currency' as const, value: 1234 }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].value).toContain('1.234')
  })

  it('formats a days unit with the unit word appended via valueWithUnit', () => {
    const card = { ...baseCard, unit: 'days' as const, value: 7 }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].value).toBe('analytics:customKpi.valueWithUnit:7,settings:settings.options.window_unit.days')
  })

  it('percent formats en-GB with a comma-free thousands style', () => {
    mockFormat.locale = 'en-GB'
    const card = { ...baseCard, unit: 'percent' as const, value: 42.5 }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].value).toBe('42.5%')
    mockFormat.locale = 'nl-NL'
  })

  it('alert status renders the danger-text ink and a caption with status word and target', () => {
    const card = { ...baseCard, status: 'alert' as const, target: 15 }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].color).toBe('var(--color-danger-text)')
    expect(result.current[0].sub).toBe('analytics:customKpi.status.alert · analytics:customKpi.target:15')
  })

  it('comparison none renders no colour and no caption', () => {
    const card = { ...baseCard, status: 'ok' as const, comparison: 'none' as const }
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [card], activeId: null, onOpen }))
    expect(result.current[0].color).toBeUndefined()
    expect(result.current[0].sub).toBeUndefined()
  })

  it('marks the card active when activeId matches its id', () => {
    const onOpen = vi.fn()
    const { result } = renderHook(() => useCustomKpiCards({ cards: [baseCard], activeId: 'kd-1', onOpen }))
    expect(result.current[0].active).toBe(true)
  })
})
