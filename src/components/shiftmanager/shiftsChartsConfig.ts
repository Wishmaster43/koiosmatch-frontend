/**
 * ShiftsChartsBlock configuration — chart series (key + colour; labels via
 * i18n charts.series.<key>), the locale-aware month abbreviation, the selectable
 * years with their per-year opacity, and the quarter → months mapping.
 */
import type { ShiftSeries } from '@/types/shiftmanager'

// Series key + colour; labels come from i18n via t('charts.series.<key>').
// Brand-aligned palette (Danny: black for Totaal is niet mooi): Totaal = brand blue,
// Niet ingevuld = brand gold, Geen kandidaat = red, Prognose = indigo, Werkelijk = green.
export const SERIES: ShiftSeries[] = [
  { key: "totaal",         color: "#1B60A9" },
  { key: "niet_ingevuld",  color: "#F0AB00" },
  { key: "geen_kandidaat", color: "#ef4444" },
  { key: "prognose",       color: "#6366f1" },
  { key: "werkelijk",      color: "#10b981" },
]

// Locale-aware short month name for index 0–11 (used for chart axis labels).
export const monthAbbr = (i: number) => new Date(2000, i, 1).toLocaleString('nl-NL', { month: "short" })

export const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]
export const YEAR_OPACITY = [1, 0.55, 0.3]

export const QUARTERS = [
  { label: "Q1", key: "Q1", months: ["01","02","03"] },
  { label: "Q2", key: "Q2", months: ["04","05","06"] },
  { label: "Q3", key: "Q3", months: ["07","08","09"] },
  { label: "Q4", key: "Q4", months: ["10","11","12"] },
]
