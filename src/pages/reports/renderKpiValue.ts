/**
 * renderKpiValue — one-liner for KPI card value formatting. Takes a raw value,
 * its presence flag, an optional unit, and returns the formatted display value.
 * Adopted on three report pages (Matches/Opportunities/Vacancies).
 */
import { formatKpiUnitValue } from './kpiUnitFormat'
import type { KpiUnit } from './kpiUnitFormat'

export function renderKpiValue(
  raw: number | null | undefined,
  has: boolean,
  unit: string | KpiUnit | undefined,
): string | number {
  return !has ? '—' : unit ? formatKpiUnitValue(raw as number, unit as KpiUnit) : raw as number
}
