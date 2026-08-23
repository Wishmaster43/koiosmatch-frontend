/**
 * useWebhookRequests — server-paginated fetch of one inbound webhook's request
 * log (K-117). Mirrors settings/sections/jobs/useJobsList's page-owns-fetch
 * shape: changing page or pageSize re-fetches; an alive-guard drops a response
 * that resolves after the webhook changes or the component unmounts (§9).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { listWebhookRequests } from './webhooksApi'
import type { WebhookRequestRow } from './webhookRequestTypes'

interface RequestsResult {
  rows: WebhookRequestRow[]
  total: number
  page: number
  lastPage: number
  perPage: number
}

const EMPTY: RequestsResult = { rows: [], total: 0, page: 1, lastPage: 1, perPage: 50 }

export function useWebhookRequests(webhookId: string | number | null) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [result, setResult] = useState<RequestsResult>(EMPTY)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const aliveRef = useRef(true)

  // Fetch the current page; an id/page/pageSize change re-runs this.
  const load = useCallback(() => {
    if (webhookId == null) return
    setPhase('loading')
    // webhooksApi.js is untyped (checkJs off); unwrapList's generic defaults to
    // `unknown` there, so the resolved shape is asserted here (§10: hand-written,
    // the spec carries no 2xx schema for this endpoint yet).
    listWebhookRequests(webhookId, page, pageSize)
      .then((data) => { if (aliveRef.current) { setResult(data as RequestsResult); setPhase('ready') } })
      .catch(() => { if (aliveRef.current) setPhase('error') })
  }, [webhookId, page, pageSize])

  useEffect(() => {
    aliveRef.current = true
    load()
    return () => { aliveRef.current = false }
  }, [load])

  // Changing the page size resets to page 1 — a stale page number would 404-ish empty.
  const changePageSize = (size: number) => { setPageSize(size); setPage(1) }

  return { page, setPage, pageSize, setPageSize: changePageSize, result, phase, reload: load }
}
