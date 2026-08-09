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
