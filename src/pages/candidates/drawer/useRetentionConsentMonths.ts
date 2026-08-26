/**
 * useRetentionConsentMonths — reads the tenant's `retention_consent_months` from
 * GET /settings (verified open to every tenant user: the route carries no permission
 * middleware and the key is neither secret- nor integration-prefixed, so it is never
 * stripped from the response).
 *
 * Pattern mirrors `lib/useKpiSettings` — a module-scope cache + one shared in-flight
 * promise, so the ten components that may want a tenant setting cause ONE GET per
 * session. Deliberately NOT `useCachedLookup`: that helper keys its cache by URL and
 * documents that no two hooks may share an endpoint, and `/settings` is already read
 * (with a different mapping) by useKpiSettings.
 *
 * The shared promise is never aborted on unmount (§9): a session-shared cache wants
 * the RESULT — the alive-guard already protects this component's state.
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { readConsentMonths } from './retentionConsent'

/** Loading/error/success of the tenant window; `months === null` means "not resolved". */
export interface RetentionConsentMonths {
  months: number | null
  loading: boolean
  error: boolean
}

// Session cache + in-flight de-dupe, shared by every mounted consumer.
let cache: number | null = null
let inFlight: Promise<{ data?: unknown }> | null = null

/** Drop the cached window so the next mount refetches (call after a Settings save). */
export function invalidateRetentionConsentMonths() {
  cache = null
  inFlight = null
}

// Seeds state synchronously from any already-resolved cache so a second mount
// never flashes loading before the effect below dedupes the fetch.
export function useRetentionConsentMonths(): RetentionConsentMonths {
  const [state, setState] = useState<RetentionConsentMonths>(() =>
    cache === null ? { months: null, loading: true, error: false } : { months: cache, loading: false, error: false })

  // One GET per session; re-armed in SETUP (StrictMode runs setup→cleanup→setup, and a
  // cleanup-only guard would leave this permanently dead).
  useEffect(() => {
    let alive = true
    if (cache !== null) {
      setState({ months: cache, loading: false, error: false })
      return () => { alive = false }
    }

    if (!inFlight) {
      inFlight = api.get('/settings')
      // Settle-cleanup runs once, not per mount; the trailing catch keeps a failed
      // settings read from surfacing as an unhandled promise rejection.
      inFlight.finally(() => { inFlight = null }).catch(() => {})
    }

    inFlight
      .then(res => {
        const months = readConsentMonths(res?.data)
        if (months !== null) cache = months
        if (alive) setState({ months, loading: false, error: months === null })
      })
      .catch(() => { if (alive) setState({ months: null, loading: false, error: true }) })

    return () => { alive = false }
  }, [])

  return state
}
