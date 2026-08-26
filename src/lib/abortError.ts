/**
 * abortError — a single predicate shared by every entity-keyed load effect
 * (§9) to tell an aborted in-flight request (StrictMode's double mount, a fast
 * unmount/id switch) apart from a real fetch failure, so cleanup never surfaces
 * a spurious error state. Split out of the old lib/mocks.ts (MOCK-CLEANUP-1):
 * this predicate has nothing to do with demo data and outlived that file.
 */
/** True when an axios error is just an aborted request (StrictMode / cleanup). */
export const isAbortError = (err: unknown): boolean => {
  const e = err as { name?: string; code?: string } | null
  return e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED'
}
