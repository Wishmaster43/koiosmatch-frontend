/**
 * useActionRulePreflight — fetches the AXIS-MATRIX-2 decision for one
 * action×subject pair and caches it for the browser session (module-scope Map,
 * mirrors useKoiosMentionCounts' session cache): the same chip/card re-rendering
 * for the same subject never re-polls the tenant. Deliberately does NOT abort on
 * unmount: the promise is session-shared, and aborting it poisoned the cache —
 * StrictMode's double-mount aborted the fresh request and every later consumer
 * (all modals, dev-wide) reused the dead promise, so no banner ever rendered
 * (audit R1 follow-up). The `alive` guard alone prevents stale setState.
 */
import { useEffect, useState } from 'react'
import { fetchActionRulePreflight } from './actionRulesApi'
import type { ActionRuleDecision, ActionRuleSubject } from './actionRuleTypes'

// Session-scoped cache: one in-flight/resolved promise per "action|subject" key,
// shared by every hook instance so re-opening the same card never re-fetches.
const cache = new Map<string, Promise<ActionRuleDecision>>()

// Stable cache key for one action×subject pair; null when the subject is empty
// (nothing to preflight yet — e.g. a form still being filled in).
function cacheKey(action: string, subject: ActionRuleSubject): string | null {
  const id = subject.candidateId ?? subject.customerId
  if (!action || !id) return null
  const axis = subject.candidateId ? 'candidate' : 'customer'
  return `${action}|${axis}|${id}`
}

export function useActionRulePreflight(action: string, subject: ActionRuleSubject) {
  const [decision, setDecision] = useState<ActionRuleDecision | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(false)

  useEffect(() => {
    const key = cacheKey(action, subject)
    if (!key) { setDecision(null); setLoading(false); setError(false); return }

    let alive = true
    setLoading(true)
    setError(false)

    // Reuse a cached (possibly still in-flight) promise for this exact pair; a
    // genuine cache MISS issues one request that is allowed to complete even if
    // this instance unmounts — the RESULT is what the session cache exists for.
    let promise = cache.get(key)
    if (!promise) {
      promise = fetchActionRulePreflight(action, subject)
      cache.set(key, promise)
    }

    promise
      .then((d) => { if (alive) setDecision(d) })
      .catch((e: { response?: { status?: number } }) => {
        // 403 = the caller's role lacks the axis view-right (BE audit 15-07: the
        // preflight routes are now permission-gated). Not an error: behave as
        // "no decision" so no popup/banner renders — and cache the outcome, the
        // role won't change mid-session.
        if (e?.response?.status === 403) { if (alive) setDecision(null); return }
        if (alive) setError(true)
        cache.delete(key)
      })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, subject.candidateId, subject.customerId])

  return { decision, loading, error }
}
