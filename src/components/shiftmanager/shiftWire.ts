/**
 * shiftWire — series ids and row normalisers for the Shiftmanager report wire.
 *
 * WIRE-IDS-ENGLISH-1 steps 1 and 2 are done: the wire is English in both
 * directions (row keys, `metric=` ids, matrix cell keys), so requests send the
 * series ids as-is and responses are read by their English keys only. The only
 * Dutch-aware code left is the saved-preset migration below, which is FE-only
 * localStorage handling and unrelated to the wire: the FE has nothing left to
 * delete when BE release B retires the Dutch aliases.
 */
import type { SeriesKey, SeriesHoursKey, ShiftMonthRow, MatrixMetricKey, MatrixCell } from '@/types/shiftmanager'

// The five chart series, in display order (shiftsChartsConfig pairs them with colours).
export const SERIES_KEYS: SeriesKey[] = ['total', 'unfilled', 'no_candidate', 'forecast', 'actual']

// The Dutch series ids a saved Shiftmanager filter preset could carry in localStorage before
// 13-11-2026; FE-only, the wire itself is English since WIRE-IDS-ENGLISH-1 step 2.
export const LEGACY_PRESET_SERIES_ID: Record<SeriesKey, string> = {
  total: 'totaal',
  unfilled: 'niet_ingevuld',
  no_candidate: 'geen_kandidaat',
  forecast: 'prognose',
  actual: 'werkelijk',
}

// Reverse lookup: Dutch preset id → English series key.
const SERIES_BY_LEGACY: Record<string, SeriesKey> = Object.fromEntries(
  (Object.entries(LEGACY_PRESET_SERIES_ID) as [SeriesKey, string][]).map(([english, legacy]) => [legacy, english]),
)

// The hours twin of a series key as the per-month rows carry it (`total_hours`).
export const hoursKeyOf = (key: SeriesKey): SeriesHoursKey => `${key}_hours`

// A persisted series id (preset saved before 13-11-2026) → the English key;
// an id that is already English, or unknown, passes through (own-property check).
export function fromLegacySeriesKey(key: string): string {
  return Object.prototype.hasOwnProperty.call(SERIES_BY_LEGACY, key) ? SERIES_BY_LEGACY[key] : key
}

// Migrates a saved preset's visible-series list in one go (order preserved).
export function migrateVisibleSeries(visible: string[]): string[] {
  return visible.map(fromLegacySeriesKey)
}

// Tolerant numeric coercion: Laravel may serialise DECIMAL columns as strings
// (§10), and an absent value counts as 0 in every aggregate.
const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// One raw per-month row → the normalised row: English keys only, 0 when a key is absent.
export function normalizeShiftMonthRow(raw: Record<string, unknown>): ShiftMonthRow {
  const row = { month: String(raw.month ?? '') } as ShiftMonthRow
  for (const key of SERIES_KEYS) {
    row[key] = num(raw[key])
    row[hoursKeyOf(key)] = num(raw[hoursKeyOf(key)])
  }
  return row
}

// The four per-candidate month metrics, in the matrix toggle's order.
export const MATRIX_METRIC_KEYS: MatrixMetricKey[] = ['forecast_hours', 'forecast_shifts', 'actual_hours', 'actual_shifts']

// One raw candidate-month cell → English keys; a metric the server omits stays
// absent (the matrix renders an omitted cell as 0 itself, the alarm logic as "no data").
export function normalizeMatrixCell(raw: Record<string, unknown> | null | undefined): MatrixCell {
  const cell: MatrixCell = {}
  if (!raw) return cell
  for (const key of MATRIX_METRIC_KEYS) {
    const value = raw[key]
    if (value != null) cell[key] = num(value)
  }
  return cell
}
