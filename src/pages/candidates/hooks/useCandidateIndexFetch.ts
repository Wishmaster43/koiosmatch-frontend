/**
 * useCandidateIndexFetch — the shared "GET /candidates/{id}/{path}, map the
 * response, abort on unmount/id change, retry on demand" shape behind
 * useCandidatePlanning's preferences/availability loads and useCandidateSchedule's
 * agenda/open-shifts loads (jscpd CANDHOOKS #6/#9 — those two hooks had each
 * grown their own near-identical copy of this). `mapResponse` does the caller's
 * own unwrap + row-mapping; pass it via `useCallback` when it closes over
 * something that should retrigger the fetch (e.g. the active locale).
 */
import { useCallback, useEffect, useState } from 'react'
import type { AxiosResponse } from 'axios'
import api from '@/lib/api'
import { isAbortError } from '@/lib/abortError'
import type { Id } from '@/types/common'

export function useCandidateIndexFetch<T>(candidateId: Id | undefined, path: string, mapResponse: (res: AxiosResponse) => T[]) {
  const [items,   setItems]   = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Fetches and maps the source; retriable via attempt, aborted on unmount/id change so a stale response never lands.
  useEffect(() => {
    if (!candidateId) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/candidates/${candidateId}/${path}`, { signal: ctrl.signal })
      .then(res => setItems(mapResponse(res)))
      .catch(err => {
        if (isAbortError(err)) return
        setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [candidateId, path, attempt, mapResponse])

  return { items, setItems, loading, error, reload: useCallback(() => setAttempt(a => a + 1), []) }
}
