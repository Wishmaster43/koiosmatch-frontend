/**
 * shiftWire — WIRE-IDS-ENGLISH-1 step 2: the FE reads English keys only and
 * migrates saved presets that still carry Dutch series ids.
 */
import { describe, it, expect } from 'vitest'
import {
  SERIES_KEYS, LEGACY_PRESET_SERIES_ID, MATRIX_METRIC_KEYS, hoursKeyOf,
  fromLegacySeriesKey, migrateVisibleSeries, normalizeShiftMonthRow, normalizeMatrixCell,
} from './shiftWire'

describe('shiftWire · normalizeShiftMonthRow', () => {
  it('reads an English wire row into English keys, hours twins included', () => {
    const row = normalizeShiftMonthRow({
      month: '2026-11', total: 10, total_hours: 80, unfilled: 2, unfilled_hours: 16,
      no_candidate: 1, no_candidate_hours: 8, forecast: 12, forecast_hours: 96, actual: 9, actual_hours: 72,
    })
    expect(row).toEqual({
      month: '2026-11', total: 10, total_hours: 80, unfilled: 2, unfilled_hours: 16,
      no_candidate: 1, no_candidate_hours: 8, forecast: 12, forecast_hours: 96, actual: 9, actual_hours: 72,
    })
  })

  it('takes the English values of a release-A dual-write row and ignores the Dutch duplicate keys', () => {
    const row = normalizeShiftMonthRow({
      maand: '2026-01', totaal: 99, totaal_uren: 999, month: '2026-03', total: 10, total_hours: 80,
    })
    expect(row.month).toBe('2026-03')
    expect(row.total).toBe(10)
    expect(row.total_hours).toBe(80)
  })

  it('yields zeros and month "" for a row that carries only Dutch keys (no legacy read survives)', () => {
    const row = normalizeShiftMonthRow({ maand: '2026-01', totaal: 7, totaal_uren: 56 })
    expect(row.month).toBe('')
    expect(row.total).toBe(0)
    expect(row.total_hours).toBe(0)
  })

  it('coerces DECIMAL strings and treats an absent or non-numeric value as 0 (§10)', () => {
    const row = normalizeShiftMonthRow({ month: '2026-01', total: '12.5', actual: 'n/a' })
    expect(row.total).toBe(12.5)
    expect(row.actual).toBe(0)
    expect(row.unfilled).toBe(0)
    expect(row.unfilled_hours).toBe(0)
  })

  it('yields a month of "" when the month key is absent', () => {
    expect(normalizeShiftMonthRow({}).month).toBe('')
  })
})

describe('shiftWire · series ids', () => {
  it('declares the five series in display order', () => {
    expect(SERIES_KEYS).toEqual(['total', 'unfilled', 'no_candidate', 'forecast', 'actual'])
  })

  it('LEGACY_PRESET_SERIES_ID keeps the Dutch preset id per series', () => {
    expect(SERIES_KEYS.map(k => LEGACY_PRESET_SERIES_ID[k])).toEqual(['totaal', 'niet_ingevuld', 'geen_kandidaat', 'prognose', 'werkelijk'])
  })

  it('hoursKeyOf appends the _hours suffix', () => {
    expect(hoursKeyOf('no_candidate')).toBe('no_candidate_hours')
  })

  it('fromLegacySeriesKey passes an inherited object name through', () => {
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
  it('reads the English candidate-month keys into the four metrics', () => {
    expect(normalizeMatrixCell({ forecast_hours: 40, forecast_shifts: 5, actual_hours: '36.5', actual_shifts: 4 }))
      .toEqual({ forecast_hours: 40, forecast_shifts: 5, actual_hours: 36.5, actual_shifts: 4 })
  })

  it('drops the Dutch twin of a dual-write cell and keeps an omitted metric absent', () => {
    expect(normalizeMatrixCell({ prognose_hours: 99, forecast_hours: 12, actual_shifts: 3 })).toEqual({ forecast_hours: 12, actual_shifts: 3 })
    expect(normalizeMatrixCell(undefined)).toEqual({})
    expect(normalizeMatrixCell(null)).toEqual({})
  })

  it('a cell that carries only Dutch keys normalises to an empty cell', () => {
    expect(normalizeMatrixCell({ prognose_hours: 40, werkelijk_shifts: 4 })).toEqual({})
  })

  it('declares the four matrix metrics in the toggle order', () => {
    expect(MATRIX_METRIC_KEYS).toEqual(['forecast_hours', 'forecast_shifts', 'actual_hours', 'actual_shifts'])
  })
})
