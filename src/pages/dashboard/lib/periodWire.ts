/**
 * periodWire — the dashboard period ids. Inside the FE every period id is English;
 * the wire still carries the Dutch value until the BE accepts English ones.
 * Removal trigger: toWirePeriod becomes the identity on the WIRE-IDS-ENGLISH-1 BE
 * dual-write hash; LEGACY_PERIOD goes when the BE retires the Dutch aliases.
 */

// The English period ids shown in the dashboard filter, in display order.
export const PERIOD_KEYS = ['today', 'week', 'month', 'quarter', 'year'] as const

export type PeriodKey = typeof PERIOD_KEYS[number]

// The Dutch value the BE still expects per English id (temporary wire mapping).
export const LEGACY_PERIOD: Record<PeriodKey, string> = {
  today: 'vandaag', week: 'week', month: 'maand', quarter: 'kwartaal', year: 'jaar',
}

// Maps a UI period id to its wire value; an unknown value passes through untouched
// (own-property check, so an inherited name such as 'constructor' passes through too).
export function toWirePeriod(key: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_PERIOD, key) ? LEGACY_PERIOD[key as PeriodKey] : key
}
