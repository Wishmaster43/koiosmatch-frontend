/**
 * formatByteSize — bytes → human size ("44856" → "44 KB"), shared by mapCandidate
 * (initial load) and documentHelpers' formatDocSize (a fresh upload/replace
 * response, which may already carry a pre-formatted string like "740 KB" —
 * `skipIfFormatted` leaves that untouched instead of re-parsing it as NaN).
 * locale is passed by callers via useNumberFormat().locale.
 */
import { formatFileSizeMb } from '@/lib/formatters'

export function formatByteSize(b: unknown, locale = 'nl-NL', skipIfFormatted = false): string {
  if (b == null || b === '') return ''
  // Already formatted upstream ("740 KB") — leave it alone.
  if (skipIfFormatted && typeof b === 'string' && /[a-z]/i.test(b)) return b
  const n = Number(b)
  if (Number.isNaN(n)) return String(b)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${formatFileSizeMb(n, locale)} MB`
}
