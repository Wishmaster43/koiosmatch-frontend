/**
 * noticePeriod — the pure maths behind the "Opzegtermijn ↔ Inzetbaar vanaf" link
 * (Danny 2026-08-08, punt 9). Kept out of NoticePeriodHint.tsx so the component
 * file exports only a component (§3 hook/util split, react-refresh clean).
 */

// Tolerant read of a stored week count — the API may serialise a numeric column as
// a string (§10), so never test `typeof x === 'number'`.
export const toNoticeWeeks = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : NaN
}

// Today + N weeks as a yyyy-mm-dd string, built from LOCAL date parts so the
// suggestion never drifts a day through a UTC round-trip. `now` is injectable so
// the calculation is deterministically testable. Null when there is nothing to derive.
export function deriveAvailableFrom(weeks: number, now: Date = new Date()): string | null {
  if (!Number.isFinite(weeks) || weeks <= 0) return null
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + weeks * 7)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
