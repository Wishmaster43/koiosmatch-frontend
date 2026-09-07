/**
 * renderKpiValue — unit test. The helper takes raw/has/unit and returns either
 * the dash (no value), the formatted value with unit, or the raw value.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderKpiValue } from './renderKpiValue'

// Mock the formatKpiUnitValue function.
const mockFormatKpiUnitValue = vi.fn((raw: number, unit: string) => {
  if (unit === 'days') return `${Math.round(raw)} days`
  if (unit === 'ratio') return `${(raw * 100).toFixed(1)}%`
  return String(raw)
})
vi.mock('./kpiUnitFormat', () => ({ formatKpiUnitValue: (raw: number, unit: string) => mockFormatKpiUnitValue(raw, unit) }))

describe('renderKpiValue — KPI value formatting', () => {
  beforeEach(() => {
    mockFormatKpiUnitValue.mockClear()
  })

  it('returns the dash when has is false', () => {
    expect(renderKpiValue(100, false, 'days')).toBe('—')
  })

  it('uses formatKpiUnitValue when unit is provided and has is true', () => {
    mockFormatKpiUnitValue.mockReturnValue('47 days')
    const result = renderKpiValue(47.6, true, 'days')
    expect(mockFormatKpiUnitValue).toHaveBeenCalledWith(47.6, 'days')
    expect(result).toBe('47 days')
  })

  it('returns raw value when has is true but unit is undefined', () => {
    const result = renderKpiValue(123, true, undefined)
    expect(mockFormatKpiUnitValue).not.toHaveBeenCalled()
    expect(result).toBe(123)
  })

  it('formats ratio units correctly', () => {
    mockFormatKpiUnitValue.mockReturnValue('37.5%')
    const result = renderKpiValue(0.375, true, 'ratio')
    expect(mockFormatKpiUnitValue).toHaveBeenCalledWith(0.375, 'ratio')
    expect(result).toBe('37.5%')
  })

  it('handles zero values (present but zero)', () => {
    const result = renderKpiValue(0, true, undefined)
    expect(result).toBe(0)
  })

  it('handles null raw values with has=false', () => {
    expect(renderKpiValue(null, false, 'days')).toBe('—')
  })
})
