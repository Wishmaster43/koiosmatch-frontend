/**
 * bureauTime — the FE twin of the backend's BureauTime (BUREAU-KLOK-FE-1).
 * Contract (K-174): date-only strings the FE sends as filters are interpreted
 * by the server in the BUREAU timezone, never the browser's. So every
 * client-computed day/period boundary must be derived in that zone — a browser
 * in New York computing "today" locally sends yesterday's bureau day.
 * The zone arrives once per session on /auth/me → tenant.timezone (a RESOLVED
 * IANA string, backend-degraded from the raw setting); AuthContext feeds it in.
 * Module-scope on purpose (the escape-layer precedent): consumers are pure
 * helpers and hooks alike, and setting a string idempotently is StrictMode-safe.
 * DISPLAY formatting stays in lib/datetime — this module is for BOUNDARIES.
 */

// The platform default mirrors the backend's TenantLocale fallback.
let bureauZone = 'Europe/Amsterdam'

// AuthContext calls this when /auth/me (or a tenant switch) lands; empty/null keeps the current zone.
export function setBureauTimezone(tz?: string | null): void {
  if (tz) bureauZone = tz
}

// The active bureau zone (test/inspection surface).
export function getBureauTimezone(): string {
  return bureauZone
}

// YYYY-MM-DD of `now` in the bureau zone — en-CA emits ISO order natively.
export function bureauToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: bureauZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

// A Date whose LOCAL calendar fields equal the bureau-zone fields of `now` —
// for callers doing calendar math (setDate/setMonth) before serialising with
// toLocalIsoDate. The instant is deliberately "wrong"; only the fields matter,
// exactly like the backend's BureauTime boundary helpers.
export function bureauNow(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: bureauZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0)
  // Some engines render midnight as "24" under hour12:false — normalise to 0.
  const hour = get('hour') === 24 ? 0 : get('hour')
  return new Date(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
}
