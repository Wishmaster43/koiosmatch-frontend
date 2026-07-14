/**
 * useActionRulePreflight — fetches the AXIS-MATRIX-2 decision for one
 * action×subject pair and caches it for the browser session (module-scope Map,
 * mirrors useKoiosMentionCounts' session cache): the same chip/card re-rendering
 * for the same subject never re-polls the tenant. Cancels its in-flight request
 * on unmount or when action/subject changes (§9 — no stale overwrite, no leak).
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

    // Reuse a cached (possibly still in-flight) promise for this exact pair; only
    // a genuine cache MISS issues a new request and owns its own abort controller
    // — a shared/reused promise must never be aborted by a later, unrelated
    // unmount (it may still be awaited by other mounted instances).
    let promise = cache.get(key)
    let controller: AbortController | null = null
    if (!promise) {
      controller = new AbortController()
      promise = fetchActionRulePreflight(action, subject, controller.signal)
      cache.set(key, promise)
    }

    promise
      .then((d) => { if (alive) setDecision(d) })
      .catch(() => { if (alive) setError(true); cache.delete(key) })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false; controller?.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, subject.candidateId, subject.customerId])

  return { decision, loading, error }
}
