/**
 * runAliveGuarded — the catch/finally/cleanup tail every entity-keyed load
 * effect repeats (§9: an id switch must never let a stale response win). Wraps
 * a promise so a caller only supplies the success handler; failure sets the
 * shared error flag and `finally` clears loading, both gated on `alive()`.
 */
export function runAliveGuarded<T>(
  promise: Promise<T>,
  alive: () => boolean,
  onSuccess: (result: T) => void,
  setError: (v: boolean) => void,
  setLoading: (v: boolean) => void,
): void {
  promise
    .then((result) => { if (alive()) onSuccess(result) })
    .catch(() => { if (alive()) setError(true) })
    .finally(() => { if (alive()) setLoading(false) })
}
