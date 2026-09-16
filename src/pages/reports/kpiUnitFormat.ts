/**
 * kpiUnitFormat — the ONE shared formatter for a server `kpis[]` entry's `unit`
 * (FRONTEND-CONTRACT §13, UNIT-CANON): 'pct' (0..100 as-is) | 'ratio' (0..1,
 * displayed ×100 with a % sign) | 'euro' (currency) | 'days' (rounded day count)
 * | no unit = a plain count, left to the KpiCard's own number formatting. Pure
 * function, locale-aware via the house lib/formatters helpers — never manual
 * string building. Every strip that renders unit-carrying entries formats through this one file (matches today; opportunities/vacancies join with their suites) so a unit never gets two display treatments.
 * unit never gets two different display treatments across reports.
 */
import { formatPercent, formatRatio, formatCurrency, formatNumber } from '@/lib/formatters'
import type { CustomKpiCard } from '@/types/analytics'

export type KpiUnit = 'pct' | 'ratio' | 'euro' | 'days'

// The unit vocabulary a tenant-defined KPI definition (KPI-BUILDER-1) can carry —
// distinct from the fixed strip's KpiUnit above (that one is server-computed
// pct/ratio/euro/days; this one is the tenant's own choice at definition time).
export type KpiDefinitionUnit = CustomKpiCard['unit']

// i18n key for the unit WORD a custom KPI's value needs next to it (e.g. "14 dagen").
// count/percent/currency carry their unit IN the formatted value itself, so they
// need no separate word — settings/window_unit already covers the calendar words.
export function kpiDefinitionUnitWordKey(unit: KpiDefinitionUnit): string | undefined {
  switch (unit) {
    case 'days': case 'workdays': case 'weeks': case 'months': case 'hours': case 'minutes':
      return `settings:settings.options.window_unit.${unit}`
    default:
      return undefined
  }
}

// Formats a tenant-defined KPI's raw value per its declared unit. Unlike
// formatKpiUnitValue below (server-computed pct/ratio), 'percent' here is
// already 0..100 (as-is, not a 0..1 ratio) — the calendar units render as a
// plain number, the unit WORD is supplied separately by the caller via
// kpiDefinitionUnitWordKey. null/undefined renders the house dash.
export function formatKpiDefinitionValue(
  raw: number | null | undefined,
  unit: KpiDefinitionUnit,
  locale: string = 'nl-NL',
  currency: string = 'EUR',
): string {
  if (raw == null) return '—'
  switch (unit) {
    case 'percent': return formatPercent(raw, locale)
    case 'currency': return formatCurrency(raw, currency, locale)
    default: return formatNumber(raw, locale)
  }
}

// Formats a server KPI value per its declared unit; null/undefined renders the
// house dash (never a fabricated 0). No unit falls back to a plain locale number.
export function formatKpiUnitValue(
  raw: number | null | undefined,
  unit: KpiUnit | undefined,
  locale: string = 'nl-NL',
): string {
  if (raw == null) return '—'
  switch (unit) {
    case 'pct': return formatPercent(raw, locale)
    case 'ratio': return formatRatio(raw, locale)
    case 'euro': return formatCurrency(raw, 'EUR', locale)
    case 'days': return formatNumber(Math.round(raw), locale)
    default: return formatNumber(raw, locale)
  }
}
