// Read retry_after (integer seconds) off any throttled 429 response (origin: LOGIN-THROTTLE-1,
// Danny 13-08); callers count it down live instead of showing the raw server string (§10).
export const retryAfterOf = (e: unknown): number | null => {
  const res = (e as { response?: { status?: number; data?: { retry_after?: unknown } } })?.response
  const secs = res?.status === 429 ? Number(res.data?.retry_after) : NaN
  return Number.isFinite(secs) && secs > 0 ? Math.ceil(secs) : null
}
