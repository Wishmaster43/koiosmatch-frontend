/**
 * kpiUnitFormat — behaviour tests for the tenant-defined KPI formatting helpers
 * (formatKpiDefinitionValue, kpiDefinitionUnitWordKey); the server-computed
 * formatKpiUnitValue path is exercised elsewhere (renderKpiValue.test.ts).
 */
import { describe, it, expect } from 'vitest'
import { formatKpiDefinitionValue, kpiDefinitionUnitWordKey } from './kpiUnitFormat'

describe('formatKpiDefinitionValue', () => {
  it('renders a plain count grouped per locale (nl)', () => {
    expect(formatKpiDefinitionValue(1234, 'count', 'nl-NL')).toBe('1.234')
  })

  it('renders a plain count grouped per locale (en-GB)', () => {
    expect(formatKpiDefinitionValue(1234, 'count', 'en-GB')).toBe('1,234')
  })

  it('renders percent as-is (0..100), never as a 0..1 ratio', () => {
    expect(formatKpiDefinitionValue(12.5, 'percent', 'nl-NL')).toBe('12,5%')
  })

  it('renders currency via formatCurrency', () => {
    expect(formatKpiDefinitionValue(99.9, 'currency', 'nl-NL', 'EUR')).toContain('99,90')
  })

  it('renders the house dash for null/undefined', () => {
    expect(formatKpiDefinitionValue(null, 'count', 'nl-NL')).toBe('—')
    expect(formatKpiDefinitionValue(undefined, 'percent', 'nl-NL')).toBe('—')
  })
})

describe('kpiDefinitionUnitWordKey', () => {
  it('maps calendar units to the shared window_unit i18n keys', () => {
    expect(kpiDefinitionUnitWordKey('days')).toBe('settings:settings.options.window_unit.days')
    expect(kpiDefinitionUnitWordKey('weeks')).toBe('settings:settings.options.window_unit.weeks')
  })

  it('returns undefined for count/percent/currency (unit carried in the value itself)', () => {
    expect(kpiDefinitionUnitWordKey('count')).toBeUndefined()
    expect(kpiDefinitionUnitWordKey('percent')).toBeUndefined()
    expect(kpiDefinitionUnitWordKey('currency')).toBeUndefined()
  })
})
