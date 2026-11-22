// Boot-probe retry policy (AUTH-BOOT-TRANSIENT-1, 22-11). The startup GET /auth/me used to turn EVERY failure
// into "logged out" (the login page), so a network blip or a 5xx under load logged a user with a valid session
// out; the smoke runs of 22-11 showed five flows in a row landing on the login page exactly that way. Only an
// auth verdict (401/403/419) means "no session"; a transient failure (no response, 408, 429, 5xx) is retried
// with a short backoff while the boot loader stays up, and only then does the app fall back to the login page;
// a deterministic 4xx is final at once, without the device-cache wipe.

// The statuses with which the server itself says "no session"; everything else is a transient failure.
export const AUTH_VERDICT_STATUSES: readonly number[] = [401, 403, 419]

// Backoff between the retries (about seven seconds in total) and the timeout of one probe attempt: on a backend
// that hangs, four attempts plus the backoff reach the login page after about 39 s instead of the 20 s default per
// request times four.
export const BOOT_PROBE_DELAYS_MS: readonly number[] = [1000, 2000, 4000]
export const BOOT_PROBE_TIMEOUT_MS = 8000

// True when the server answered with an auth verdict; false for a network error, a timeout, a 5xx or a 429.
export function isAuthVerdict(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status
  return typeof status === 'number' && AUTH_VERDICT_STATUSES.includes(status)
}

// True for a failure worth a retry: no response at all (network error, timeout, abort), a 408, a 429 or a 5xx.
// A deterministic 4xx (400/404/422) is final: the server answered and would answer the same way again.
export function isTransientFailure(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | null)?.response?.status
  if (typeof status !== 'number') return true
  return status === 408 || status === 429 || status >= 500
}

// Thrown instead of a probe result when the owner unmounted during a backoff; the caller ignores it.
export class BootProbeAborted extends Error {
  constructor() {
    super('boot probe aborted')
    this.name = 'BootProbeAborted'
  }
}

type RetryOptions = {
  delays?: readonly number[]
  isAlive?: () => boolean
  sleep?: (ms: number) => Promise<void>
}

// Run `probe` until it resolves, retrying only transient failures after each delay. Rejects at once with a
// verdict or a deterministic 4xx, with the last error once the delays are spent, and with BootProbeAborted when `isAlive` turns
// false during a backoff (StrictMode runs an effect setup, cleanup, setup: the first chain must not retry).
export async function probeSessionWithRetry<T>(
  probe: () => Promise<T>,
  { delays = BOOT_PROBE_DELAYS_MS, isAlive = () => true, sleep = defaultSleep }: RetryOptions = {},
): Promise<T> {
  let attempt = 0
  for (;;) {
    try {
      return await probe()
    } catch (err) {
      if (isAuthVerdict(err) || !isTransientFailure(err) || attempt >= delays.length) throw err
      await sleep(delays[attempt] ?? 0)
      attempt += 1
      if (!isAlive()) throw new BootProbeAborted()
    }
  }
}

// Plain timer sleep; tests inject their own.
function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
