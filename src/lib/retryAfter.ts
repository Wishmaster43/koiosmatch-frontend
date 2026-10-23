// Read the login throttle's machine field off a 429 (LOGIN-THROTTLE-1, Danny 13-08):
// the backend sends retry_after (integer seconds) beside its message; we count that
// down live instead of parroting the raw — static, Dutch-only — server string (§10).
export const retryAfterOf = (e: unknown): number | null => {
  const res = (e as { response?: { status?: number; data?: { retry_after?: unknown } } })?.response
  const secs = res?.status === 429 ? Number(res.data?.retry_after) : NaN
  return Number.isFinite(secs) && secs > 0 ? Math.ceil(secs) : null
}
