/**
 * shiftWire — the ONE seam between the Shiftmanager report wire format and the
 * English series ids the FE uses (WIRE-IDS-ENGLISH-1 step 1, 13-11-2026).
 *
 * The BE still speaks Dutch ids on /sm_reports/shifts-per-month (row keys
 * `maand`, `totaal`, `totaal_uren`, …), on the `metric=` request param of
 * shifts-per-month/detail and shifts-breakdown, and on /sm_reports/
 * shifts-per-candidate (`prognose_hours`, …). Inside the FE every series key,
 * chart dataKey, i18n key and saved-preset value is English; this module
 * translates at the edge, in both directions, so no other file knows the Dutch
 * spelling. Reads are tolerant (English ?? Dutch) so the BE's dual-write can land
 * in any order relative to this file.
 *
 * Removal triggers: step 2 (the BE accepts English metric ids and dual-writes the
 * response keys, WIRE-IDS-ENGLISH-1 BE hash): toWireMetric becomes the identity;
 * step 3 (the BE retires the Dutch aliases): delete the two LEGACY maps, the
 * `?? legacy` reads and the migrateVisibleSeries call.
 */
import type { SeriesKey, SeriesHoursKey, ShiftMonthRow, MatrixMetricKey, MatrixCell } from '@/types/shiftmanager'

// The five chart series, in display order (shiftsChartsConfig pairs them with colours).
export const SERIES_KEYS: SeriesKey[] = ['total', 'unfilled', 'no_candidate', 'forecast', 'actual']

// English series key → the Dutch id the BE still sends and accepts.
export const LEGACY_SERIES_KEY: Record<SeriesKey, string> = {
  total: 'totaal',
  unfilled: 'niet_ingevuld',
  no_candidate: 'geen_kandidaat',
  forecast: 'prognose',
  actual: 'werkelijk',
}

// Reverse lookup: Dutch wire id → English series key.
const SERIES_BY_LEGACY: Record<string, SeriesKey> = Object.fromEntries(
  (Object.entries(LEGACY_SERIES_KEY) as [SeriesKey, string][]).map(([english, legacy]) => [legacy, english]),
)

// The hours twin of a series key as the per-month rows carry it (`total_hours`).
export const hoursKeyOf = (key: SeriesKey): SeriesHoursKey => `${key}_hours`

// Request side: the metric id the BE accepts today (Dutch until the dual-write hash);
// an id outside the series set (a caller's own value) passes through untouched
// (own-property check, so an inherited name such as 'constructor' passes through too).
export function toWireMetric(key: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_SERIES_KEY, key) ? LEGACY_SERIES_KEY[key as SeriesKey] : key
}

// A persisted series id (saved filter preset written before this change) → the
// English key; an id that is already English, or unknown, passes through.
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

// One raw per-month row → the normalised English row: English key when the BE
// sends it (even when it is 0), the Dutch twin otherwise, 0 when neither exists.
export function normalizeShiftMonthRow(raw: Record<string, unknown>): ShiftMonthRow {
  const row = { month: String(raw.month ?? raw.maand ?? '') } as ShiftMonthRow
  for (const key of SERIES_KEYS) {
    const legacy = LEGACY_SERIES_KEY[key]
    row[key] = num(raw[key] ?? raw[legacy])
    row[hoursKeyOf(key)] = num(raw[hoursKeyOf(key)] ?? raw[`${legacy}_uren`])
  }
  return row
}

// The four per-candidate month metrics, in the matrix toggle's order.
export const MATRIX_METRIC_KEYS: MatrixMetricKey[] = ['forecast_hours', 'forecast_shifts', 'actual_hours', 'actual_shifts']

// English matrix metric → the Dutch-prefixed key /sm_reports/shifts-per-candidate still sends.
const LEGACY_MATRIX_KEY: Record<MatrixMetricKey, string> = {
  forecast_hours: 'prognose_hours',
  forecast_shifts: 'prognose_shifts',
  actual_hours: 'werkelijk_hours',
  actual_shifts: 'werkelijk_shifts',
}

// One raw candidate-month cell → English keys; a metric the server omits stays
// absent (the matrix renders an omitted cell as 0 itself, the alarm logic as "no data").
export function normalizeMatrixCell(raw: Record<string, unknown> | null | undefined): MatrixCell {
  const cell: MatrixCell = {}
  if (!raw) return cell
  for (const key of MATRIX_METRIC_KEYS) {
    const value = raw[key] ?? raw[LEGACY_MATRIX_KEY[key]]
    if (value != null) cell[key] = num(value)
  }
  return cell
}
