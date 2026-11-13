/**
 * shiftWire — WIRE-IDS-ENGLISH-1 step 1: the FE reads English series ids with a
 * Dutch fallback (dual-write can land in any order), sends the Dutch metric id the
 * BE accepts today, and migrates saved presets that still carry Dutch series ids.
 */
import { describe, it, expect } from 'vitest'
import {
  SERIES_KEYS, LEGACY_SERIES_KEY, MATRIX_METRIC_KEYS, hoursKeyOf, toWireMetric,
  fromLegacySeriesKey, migrateVisibleSeries, normalizeShiftMonthRow, normalizeMatrixCell,
} from './shiftWire'

describe('shiftWire · normalizeShiftMonthRow', () => {
  it('reads a Dutch wire row (today) into English keys, hours twins included', () => {
    const row = normalizeShiftMonthRow({
      maand: '2026-11', totaal: 10, totaal_uren: 80, niet_ingevuld: 2, niet_ingevuld_uren: 16,
      geen_kandidaat: 1, geen_kandidaat_uren: 8, prognose: 12, prognose_uren: 96, werkelijk: 9, werkelijk_uren: 72,
    })
    expect(row).toEqual({
      month: '2026-11', total: 10, total_hours: 80, unfilled: 2, unfilled_hours: 16,
      no_candidate: 1, no_candidate_hours: 8, forecast: 12, forecast_hours: 96, actual: 9, actual_hours: 72,
    })
  })

  it('reads an English wire row (after the BE dual-write) identically', () => {
    const row = normalizeShiftMonthRow({ month: '2026-11', total: 10, total_hours: 80, forecast: 12, forecast_hours: 96 })
    expect(row.month).toBe('2026-11')
    expect(row.total).toBe(10)
    expect(row.total_hours).toBe(80)
    expect(row.forecast).toBe(12)
    expect(row.forecast_hours).toBe(96)
  })

  it('lets the English key win when both spellings arrive, even when the English value is 0', () => {
    const row = normalizeShiftMonthRow({ month: '2026-11', maand: '1999-01', total: 0, totaal: 7, total_hours: 0, totaal_uren: 56 })
    expect(row.month).toBe('2026-11')
    expect(row.total).toBe(0)
    expect(row.total_hours).toBe(0)
  })

  it('coerces DECIMAL strings and treats an absent or non-numeric value as 0 (§10)', () => {
    const row = normalizeShiftMonthRow({ maand: '2026-01', totaal: '12.5', werkelijk: 'n/a' })
    expect(row.total).toBe(12.5)
    expect(row.actual).toBe(0)
    expect(row.unfilled).toBe(0)
    expect(row.unfilled_hours).toBe(0)
  })

  it('yields a month of "" when neither spelling of the month key is present', () => {
    expect(normalizeShiftMonthRow({}).month).toBe('')
  })
})

describe('shiftWire · series ids', () => {
  it('declares the five series in display order with a Dutch wire id each', () => {
    expect(SERIES_KEYS).toEqual(['total', 'unfilled', 'no_candidate', 'forecast', 'actual'])
    expect(SERIES_KEYS.map(k => LEGACY_SERIES_KEY[k])).toEqual(['totaal', 'niet_ingevuld', 'geen_kandidaat', 'prognose', 'werkelijk'])
  })

  it('hoursKeyOf appends the _hours suffix', () => {
    expect(hoursKeyOf('no_candidate')).toBe('no_candidate_hours')
  })

  it('toWireMetric sends the Dutch id for a series key and passes an unknown id through', () => {
    expect(toWireMetric('total')).toBe('totaal')
    expect(toWireMetric('no_candidate')).toBe('geen_kandidaat')
    expect(toWireMetric('something_else')).toBe('something_else')
    // Own-property lookup: an inherited object name is not a series id either.
    expect(toWireMetric('constructor')).toBe('constructor')
    expect(fromLegacySeriesKey('constructor')).toBe('constructor')
  })

  it('fromLegacySeriesKey maps a Dutch id to English and leaves English or unknown ids alone', () => {
    expect(fromLegacySeriesKey('totaal')).toBe('total')
    expect(fromLegacySeriesKey('total')).toBe('total')
    expect(fromLegacySeriesKey('unknown')).toBe('unknown')
  })

  it('migrateVisibleSeries migrates a saved preset list in place order', () => {
    expect(migrateVisibleSeries(['totaal', 'forecast', 'werkelijk', 'x'])).toEqual(['total', 'forecast', 'actual', 'x'])
  })
})

describe('shiftWire · normalizeMatrixCell', () => {
  it('reads the Dutch-prefixed candidate-month keys into the four English metrics', () => {
    expect(normalizeMatrixCell({ prognose_hours: 40, prognose_shifts: 5, werkelijk_hours: '36.5', werkelijk_shifts: 4 }))
      .toEqual({ forecast_hours: 40, forecast_shifts: 5, actual_hours: 36.5, actual_shifts: 4 })
  })

  it('keeps an omitted metric absent and lets the English key win over the Dutch one', () => {
    expect(normalizeMatrixCell({ forecast_hours: 0, prognose_hours: 9 })).toEqual({ forecast_hours: 0 })
    expect(normalizeMatrixCell(undefined)).toEqual({})
    expect(normalizeMatrixCell(null)).toEqual({})
  })

  it('declares the four matrix metrics in the toggle order', () => {
    expect(MATRIX_METRIC_KEYS).toEqual(['forecast_hours', 'forecast_shifts', 'actual_hours', 'actual_shifts'])
  })
})
