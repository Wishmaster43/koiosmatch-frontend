/**
 * useLeadReceipts (LEAD-LEDGER-1) — loads the Facebook lead queue: the counts summary and one
 * page of receipts for a status filter, plus the retry action. Only Meta ids and bookkeeping
 * travel here, never lead data.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'

export type ReceiptStatus = 'pending' | 'retrieved' | 'rejected' | 'failed'

export interface LeadReceipt {
  id: number | string
  form_id: string | null
  status: ReceiptStatus
  attempts: number
  last_error_code: string | null
  next_retry_at: string | null
  escalated_at: string | null
  retrieved_at: string | null
  candidate_id: string | number | null
  created_at: string | null
}

export interface LeadSummary {
  pending: number
  retrieved: number
  rejected: number
  failed: number
  oldest_pending_at: string | null
}

const PER_PAGE = 25

// Loads summary + one receipts page; retry() re-dispatches a receipt and swaps in the returned row.
export function useLeadReceipts(initialStatus: ReceiptStatus | '' = 'pending') {
  const { t } = useTranslation('settings')
  const [status, setStatusState] = useState<ReceiptStatus | ''>(initialStatus)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<LeadReceipt[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [summary, setSummary] = useState<LeadSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<LeadReceipt['id'] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Receipts page for the current filter; the alive guard drops a stale response after a filter switch.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(false)
    const params: Record<string, string | number> = { per_page: PER_PAGE, page }
    if (status) params.status = status
    api.get('/facebook-leads/receipts', { params }).then((res) => {
      if (!alive) return
      const list = unwrapList<LeadReceipt>(res)
      setRows(list.rows)
      setTotal(list.total)
      setLastPage(list.lastPage)
    }).catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [status, page, reloadKey])

  // Counts summary, loaded on mount and after every retry.
  const [summaryKey, setSummaryKey] = useState(0)
  // A failed summary request is reported, never rendered as an empty counts block.
  const [summaryError, setSummaryError] = useState(false)
  useEffect(() => {
    let alive = true
    setSummaryError(false)
    api.get('/facebook-leads/receipts/summary').then((res) => {
      if (alive) setSummary((res.data?.data ?? null) as LeadSummary | null)
    }).catch(() => { if (alive) { setSummary(null); setSummaryError(true) } })
    return () => { alive = false }
  }, [summaryKey, reloadKey])

  // Filter change always restarts at page one.
  const setStatus = useCallback((next: ReceiptStatus | '') => { setStatusState(next); setPage(1) }, [])

  // Re-dispatches one receipt; a 422 lead_already_retrieved gets its own translated message.
  const retry = useCallback(async (id: LeadReceipt['id']) => {
    setRetryError(null)
    setRetryingId(id)
    try {
      const res = await api.post(`/facebook-leads/receipts/${id}/retry`)
      const row = res.data?.data as LeadReceipt | undefined
      if (row) setRows((prev) => prev.map((r) => (r.id === id ? row : r)))
      setSummaryKey((k) => k + 1)
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      // Only the contract code is mapped; every other failure (404, 403, 5xx, network) shows the translated fallback, never a raw server message.
      setRetryError(code === 'lead_already_retrieved'
        ? t('facebookLeads.queue.alreadyRetrieved')
        : code === 'lead_in_flight'
          ? t('facebookLeads.queue.retryInFlight')
          : t('facebookLeads.queue.retryFailed'))
    } finally {
      setRetryingId(null)
    }
  }, [t])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  return { status, setStatus, page, setPage, rows, total, lastPage, perPage: PER_PAGE, summary, summaryError, loading, error, retry, retryError, retryingId, reload }
}
