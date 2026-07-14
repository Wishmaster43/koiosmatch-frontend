/**
 * useQueueSummary — per-queue + per-tenant backlog health for the Taakbeheer
 * overview tab. Polls modestly (15s, Danny's "never hammer") and ONLY while the
 * tab is actually visible, so an idle background tab stops hitting the API.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchQueueSummary } from './jobsApi'

const POLL_MS = 15000

export function useQueueSummary() {
  const [summary, setSummary] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | ready | error
  const abortRef = useRef(null)

  // One fetch cycle — cancels any in-flight request first (tab switch / manual refresh).
  const load = useCallback(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetchQueueSummary(ctrl.signal)
      .then((data) => { setSummary(data); setPhase('ready') })
      .catch((err) => { if (err?.code !== 'ERR_CANCELED') setPhase('error') })
  }, [])

  // Initial load + a 15s poll that skips ticks while the browser tab is hidden.
  useEffect(() => {
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    return () => { clearInterval(id); abortRef.current?.abort() }
  }, [load])

  return { summary, phase, refetch: load }
}
