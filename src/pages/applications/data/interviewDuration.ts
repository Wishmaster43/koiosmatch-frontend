/**
 * interviewDuration — pure duration helpers for the interview status card,
 * in their own module so the card file exports components only (react-refresh)
 * and the derivations stay unit-testable without rendering.
 */
import type { ApplicationInterview } from '@/types/application'

/**
 * resolveDurationSeconds — ELAPSED seconds since the session started, NOT how
 * long the conversation took: the backend measures created_at → completed_at ??
 * now(), so an overnight WhatsApp thread legitimately reads as days. Prefer that
 * explicit field (detail contract); otherwise derive the same span from
 * started_at → (endedAt ?? lastMessageAt), which is all a list payload could
 * offer. Null when no timing signal exists — never a guessed number. Pure/
 * exported so the derivation is unit-testable without rendering.
 */
export function resolveDurationSeconds(iv: ApplicationInterview): number | null {
  if (iv.durationSeconds != null) return iv.durationSeconds
  const end = iv.endedAt ?? iv.lastMessageAt
  if (!iv.startedAt || !end) return null
  const start = new Date(iv.startedAt).getTime()
  const stop = new Date(end).getTime()
  if (Number.isNaN(start) || Number.isNaN(stop)) return null
  return Math.max(0, Math.round((stop - start) / 1000))
}

/**
 * splitDuration — whole seconds → {days, hours, minutes}. Days exist because this
 * is wall-clock elapsed time: a thread answered the next morning is ~14 hours and
 * one answered after a weekend is days, and "96u 15min" is unreadable. `hours` is
 * the remainder within the day, so days+hours+minutes always describe one span.
 */
export function splitDuration(totalSeconds: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60))
  const totalHours = Math.floor(totalMinutes / 60)
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24, minutes: totalMinutes % 60 }
}
