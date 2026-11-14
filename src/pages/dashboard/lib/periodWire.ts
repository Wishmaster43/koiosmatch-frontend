/**
 * periodWire — the dashboard period ids, English on the wire since WIRE-IDS-ENGLISH-1 step 2.
 */

// The English period ids shown in the dashboard filter, in display order.
export const PERIOD_KEYS = ['today', 'week', 'month', 'quarter', 'year'] as const

export type PeriodKey = typeof PERIOD_KEYS[number]
