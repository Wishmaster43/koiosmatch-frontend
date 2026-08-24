/**
 * isReversedInterviewRange — true when `finishedAt` sits BEFORE `startedAt`.
 * Measured cause (seeded data, being filed with CMBE separately): the WhatsApp
 * interview history row can carry a `completed_at` that predates its own
 * `created_at`. Rendering a "10:00 – 09:00" range would lie about the order of
 * events, so the caller shows only the finished date instead. Pure/exported so
 * the derivation is unit-testable without rendering.
 */
export function isReversedInterviewRange(startedAt: string | null, finishedAt: string | null): boolean {
  if (!startedAt || !finishedAt) return false
  const start = new Date(startedAt).getTime()
  const end = new Date(finishedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  return end < start
}
