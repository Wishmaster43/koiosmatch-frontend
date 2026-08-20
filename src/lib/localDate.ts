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

// DATUM-1 (Danny 13-08: a user must NEVER see a raw ISO date): rewrites every
// embedded ISO date/timestamp inside a server-composed sentence to the house
// DD-MM-YYYY (+ HH:mm) format — e.g. the AXIS preflight "tot 2027-08-08".
// Text-level on purpose: these strings are tenant-configurable prose we render
// verbatim, so we cannot format a field — only repair the date notation inside.
const ISO_TIMESTAMP_RE = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g
const ISO_DATE_RE = /\b(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g
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
const DT_DATE = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
const DT_TIME = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false })
export function formatDateOnly(dt?: string | number | Date | null): string {
  if (!dt) return '—'
  const d = new Date(dt)
  return isNaN(d.getTime()) ? '—' : DT_DATE.format(d).replace(/\//g, '-')
}
export function formatDateTimeStr(dt?: string | number | Date | null): string {
  if (!dt) return '—'
  const d = new Date(dt)
  return isNaN(d.getTime()) ? '—' : `${DT_DATE.format(d).replace(/\//g, '-')} ${DT_TIME.format(d)}`
}
