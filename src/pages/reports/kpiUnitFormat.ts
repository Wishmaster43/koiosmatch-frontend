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

export type KpiUnit = 'pct' | 'ratio' | 'euro' | 'days'

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
