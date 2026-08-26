/**
 * localDate — the calendar-day conversion, deliberately in its OWN module.
 *
 * Why not in `lib/datetime` (where it started): that module imports the i18n
 * singleton for locale-aware formatting, and importing it has an initialising
 * SIDE EFFECT. Pulling this helper from there into the shared DateField dragged
 * that init into every form — and every test that renders one — which flipped ~27
 * assertions from raw i18n keys to real translations in one commit. This function
 * needs no locale at all, so it has no business living behind that import.
 *
 * A pure helper belongs in a module with the dependencies IT needs, not the ones
 * its neighbours happen to need.
 */

/**
 * A Date as `YYYY-MM-DD`, read from its LOCAL calendar day.
 *
 * `.toISOString().slice(0, 10)` converts through UTC first, so in any zone ahead
 * of UTC a date picked around local midnight rolls back a day. Measured in
 * Europe/Amsterdam: picking 1 July 2026 stored `2026-06-30`, and 15 January 2026
 * stored `2026-01-14` — the whole year round, summer and winter. On a birthdate
 * that is a wrong age; on a work-permit expiry it is a wrong end date.
 */
export function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// House numeric shapes (DATUM-1): DD-MM-YYYY and HH:mm, built from date parts so
// no locale can reshape them. Live here, not in datetime.ts, so a PURE module
// (no hook access) can render the canonical date shape without dragging in that
// module's i18n import — datetime.ts re-exports these for its own hook formatters.
const pad2 = (n: number) => String(n).padStart(2, '0')
export const ddmmyyyy = (d: Date) => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
export const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
// HH:mm:ss — for the few surfaces where seconds matter (a workflow run's own
// step timing, a jobs-board completion time). Same house-numeric contract as
// ddmmyyyy/hhmm above: digits only, so no locale parameter is needed.
export const hhmmss = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

// DATUM-1 (Danny 13-08: a user must NEVER see a raw ISO date): rewrites every
// embedded ISO date/timestamp inside a server-composed sentence to the house
// DD-MM-YYYY (+ HH:mm) format — e.g. the AXIS preflight "tot 2027-08-08".
// Text-level on purpose: these strings are tenant-configurable prose we render
// verbatim, so we cannot format a field — only repair the date notation inside.
const ISO_TIMESTAMP_RE = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g
const ISO_DATE_RE = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g
// Rewrites every embedded ISO date/timestamp inside a string to DD-MM-YYYY[ HH:mm] —
// text-level because the surrounding prose is server-composed and can't be reformatted as a field.
export function humanizeIsoDates(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(ISO_TIMESTAMP_RE, (_, y, m, d, hh, mm) => `${d}-${m}-${y} ${hh}:${mm}`)
    .replace(ISO_DATE_RE, (_, y, m, d) => `${d}-${m}-${y}`)
}

// Non-hook DD-MM-YYYY[+ HH:mm] formatters (heraudit I18N-2): the ONE string
// builder for contexts without hook access (table parts, run/message logs).
// They live HERE, not in datetime.ts, because that module's i18n import has an
// initialising side effect (raw-key unit tests must stay side-effect-free).
// Built on ddmmyyyy/hhmm above, so this file states ONE principle: a numeric date is
// assembled from date parts and no locale can reshape it (an Intl twin pinned to nl-NL
// used to sit here and quietly disagreed with its own neighbours).
export function formatDateOnly(dt?: string | number | Date | null): string {
  if (!dt) return '—'
  const d = new Date(dt)
  return isNaN(d.getTime()) ? '—' : ddmmyyyy(d)
}
// Same non-hook DD-MM-YYYY formatting as formatDateOnly above, with the time appended;
// an invalid/missing input renders as a dash, never a raw value.
export function formatDateTimeStr(dt?: string | number | Date | null): string {
  if (!dt) return '—'
  const d = new Date(dt)
  return isNaN(d.getTime()) ? '—' : `${ddmmyyyy(d)} ${hhmm(d)}`
}
