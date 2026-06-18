/**
 * Mock/demo data guard.
 *
 * Several pages ship seeded sample data so the UI can be demoed before the
 * backend returns rows. That seed must NEVER appear in production, and must not
 * mask a failed/empty API call as if it were real data.
 *
 * USE_MOCKS is therefore off unless you explicitly opt in locally:
 *   VITE_USE_MOCKS=true npm run dev
 * It is force-disabled in any production build (import.meta.env.DEV === false).
 */
export const USE_MOCKS =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true'

/** True when an axios error is just an aborted request (StrictMode / cleanup). */
export const isAbortError = (err) =>
  err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED'
