/**
 * windowUnit — the FE twin of the backend's `App\Support\Windows\WindowUnit`
 * (koiosmatch-api). Converts a tenant-configured amount + unit (days/workdays/
 * weeks/months) into a real BOUNDARY DATE, never a rounded day count, so every
 * FE reader of a day-window setting (vacancy staleness, match renewal, …)
 * agrees with the backend's own attention flags on the same tenant setting.
 *
 * Pure and dependency-free on purpose (DATETIME-IMPORT-LES): a helper a rule
 * engine imports must never pull in `@/lib/datetime`'s i18n side effect, so
 * this lives in its own module with no settings/api import — `readWindowSetting`
 * lives next to `getNumberSetting` in `settings/useAllSettings.ts` instead.
 *
 * TIMEZONE NOTE: every boundary is computed in the BROWSER's local day, standing
 * in for the backend's bureau timezone — there is no server-side timezone
 * config on the FE to read. Deliberate deviation for `days`/`weeks`/`months`:
 * they keep `from`'s time-of-day (not a start-of-day reset) so existing `days`
 * tenants see byte-identical behaviour to the pre-WINDOW-UNIT-READERS-1 code;
 * only `workdays` walks from start-of-day, mirroring BureauTime on the backend.
 */
export const WINDOW_UNITS = ['days', 'workdays', 'weeks', 'months'] as const
export type WindowUnit = (typeof WINDOW_UNITS)[number]

// Type guard so a tolerant read of an unknown stored string can fall back cleanly.
export function isWindowUnit(x: unknown): x is WindowUnit {
  return typeof x === 'string' && (WINDOW_UNITS as readonly string[]).includes(x)
}

// Walks one calendar day at a time from the START of `from`'s day, skipping
// Saturday/Sunday, `amount` times in `direction` (+1 ahead, -1 back). Mirrors
// the backend's workdaysAgo/workdaysAhead — no public-holiday calendar, same
// documented limitation.
function walkWorkdays(from: Date, amount: number, direction: 1 | -1): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  let remaining = amount
  while (remaining > 0) {
    d.setDate(d.getDate() + direction)
    const day = d.getDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return d
}

// Shifts `from` by ±`amount` months with NO overflow (mirrors Carbon's
// add/subMonthsNoOverflow, koiosmatch-api WindowUnit.php:237/251): 31-01 + 1
// month = 28/29-02, never rolling into March. Clamps the day-of-month to the
// target month's real last day instead of letting JS Date.setMonth overflow.
function shiftMonthsClamped(from: Date, amount: number): Date {
  const day = from.getDate()
  const d = new Date(from)
  d.setDate(1)
  d.setMonth(d.getMonth() + amount)
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDayOfTargetMonth))
  return d
}

// The boundary `amount` `unit`s AFTER `from` — e.g. "the end date is within
// the renewal window" reads `end <= windowBoundaryAfter(now, amount, unit)`.
export function windowBoundaryAfter(from: Date, amount: number, unit: WindowUnit): Date {
  if (unit === 'workdays') return walkWorkdays(from, amount, 1)
  if (unit === 'months') return shiftMonthsClamped(from, amount)
  const d = new Date(from)
  if (unit === 'days') d.setDate(d.getDate() + amount)
  else d.setDate(d.getDate() + amount * 7) // weeks
  return d
}

// The boundary `amount` `unit`s BEFORE `from` — e.g. "published before this
// point counts as stale" reads `publishedAt <= windowBoundaryBefore(now, amount, unit)`.
export function windowBoundaryBefore(from: Date, amount: number, unit: WindowUnit): Date {
  if (unit === 'workdays') return walkWorkdays(from, amount, -1)
  if (unit === 'months') return shiftMonthsClamped(from, -amount)
  const d = new Date(from)
  if (unit === 'days') d.setDate(d.getDate() - amount)
  else d.setDate(d.getDate() - amount * 7) // weeks
  return d
}

// The window's size in WHOLE days between `from` and its boundary, the granularity the
// advice engines compare their own `daysSince`/`daysUntilEnd` against (so the `days`
// unit stays exactly the old `days >= N` / `days <= N` truth). days/weeks/months keep
// the time of day, so the gap is N whole days give or take a DST hour: round restores N.
// workdays walks from the start of the day, so its gap is never a whole number: floor.
export function windowDays(from: Date, boundary: Date, unit: WindowUnit): number {
  const gap = Math.abs(boundary.getTime() - from.getTime()) / 86_400_000
  return unit === 'workdays' ? Math.floor(gap) : Math.round(gap)
}
