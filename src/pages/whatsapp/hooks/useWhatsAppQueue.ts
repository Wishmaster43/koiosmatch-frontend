/**
 * useWhatsAppQueue — data layer for the "Wachtrij" tab (WABA batch queue, R3a).
 * Loads today's batches from GET /whatsapp-queue and polls every 5s ONLY while at
 * least one batch is still active — the moment every batch has finished, polling
 * stops so the tab doesn't keep hammering the backend while idle. The endpoint now
 * ships (item 11, was quiet404'd before it existed) — a 404 still flags the calm
 * "not available yet" state below, but also surfaces in the dev log like any
 * other real failure.
 */
import { useState, useEffect, useCallback } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { WaQueueBatch } from '@/types/whatsapp'
import { useVisiblePoll } from '@/hooks/useVisiblePoll'

const POLL_MS = 5000

// A batch still running: no finished_at and a non-terminal status.
export const isBatchActive = (b: WaQueueBatch): boolean =>
  !b.finished_at && String(b.status ?? '').toLowerCase() !== 'finished'

// Sum one numeric field (queued/sent/skipped/failed) across today's batches — the
// WhatsApp page's KPI band uses this for "Queued today" / "Failed sends today"
// (WA-KPI9-1), a real aggregate of the same rows QueueTab renders, never invented.
export const sumBatches = (batches: WaQueueBatch[], field: 'queued' | 'sent' | 'skipped' | 'failed'): number =>
  batches.reduce((sum, b) => sum + (b[field] ?? 0), 0)

// Loads today's WABA batch queue and polls every 5s only while a batch is still
// active, stopping the instant everything has finished (see file doc).
export function useWhatsAppQueue() {
  const [batches,      setBatches]      = useState<WaQueueBatch[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)

  // Load today's batches; a 404 flags "not shipped yet", any other failure is a real error.
  const load = useCallback(() => {
    api.get('/whatsapp-queue')
      .then(r => { setBatches((unwrapList(r).rows) as WaQueueBatch[]); setNotAvailable(false); setError(false) })
      .catch(err => {
        if (err.response?.status === 404) setNotAvailable(true)
        else setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Poll while visible (shared useVisiblePoll); disable if no active batches or an error occurred.
  const shouldPoll = !notAvailable && !error && batches.some(isBatchActive)
  useVisiblePoll(load, POLL_MS, shouldPoll)

  return { batches, loading, error, notAvailable, reload: load }
}
