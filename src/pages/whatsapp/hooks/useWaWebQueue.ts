/**
 * useWaWebQueue — data layer for the WA-Web queue tab (K-193 fase 1): the
 * private WhatsApp (WAHA/Baileys) outbox, distinct from the WABA batch queue
 * (useWhatsAppQueue.ts). React Query backs both the row list (`GET
 * /whatsapp-web/queue`) and the per-number stats (`GET /whatsapp-web/queue/
 * stats`) — polling every 5s only while a row is still queued/sending, exactly
 * mirroring the WABA queue's own "stop polling once idle" rule.
 * Row/stats shapes are measured against WhatsappQueueController::row()/
 * OutboxStats::perNumber() (koiosmatch-api) — the wire carries `number_id`
 * only (no nested number object) and `priority` as a raw integer snapshot of
 * the message type at enqueue time, never a high/normal/low slug.
 */
import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'

const POLL_MS = 5000

// One outbox row (WhatsappQueueController::row) — PII-arm, no phone/body on the wire.
export interface WaWebQueueRow {
  id: string
  candidate: { id: string; name: string } | null
  message_type: { value?: string; label: string; color?: string | null } | null
  // Higher = more urgent (App\Messaging\Models\OutboxMessage cast: integer).
  priority: number
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'paused' | 'canceled' | string
  attempts: number
  scheduled_at?: string | null
  number_id?: string | null
  // WA-5 hold reason (scheduled | rate_limit | new_number_<window> | priority_wait |
  // ready), only ever set while status is 'queued'.
  hold_reason?: string | null
}

// One device's queue stats (App\Messaging\OutboxStats::perNumber).
export interface WaWebQueueNumberStats {
  number_id: string
  label: string | null
  rate_limit: number
  in_queue: number
  est_drain: number | null
}

// A row still waiting to drain — polling stays on while any of these exist.
const isRowActive = (r: WaWebQueueRow): boolean => r.status === 'queued' || r.status === 'sending'

// List query — optional status filter, forwarded straight to the backend's own
// `status` scalar validation.
export function useWaWebQueueList(status?: string) {
  return useQuery({
    queryKey: ['wa-web-queue', status ?? 'all'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/whatsapp-web/queue', { params: status ? { status } : undefined, signal })
      return unwrapList<WaWebQueueRow>(res).rows
    },
    // Poll only while something is still moving — matches useWhatsAppQueue's cadence.
    refetchInterval: (query) => {
      const rows = query.state.data as WaWebQueueRow[] | undefined
      return rows?.some(isRowActive) ? POLL_MS : false
    },
  })
}

// Per-number stats strip — same 5s cadence while the list is still active (the
// caller passes `active` from the list query so the two never disagree).
export function useWaWebQueueStats(active: boolean) {
  return useQuery({
    queryKey: ['wa-web-queue-stats'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/whatsapp-web/queue/stats', { signal })
      return unwrapList<WaWebQueueNumberStats>(res).rows
    },
    refetchInterval: active ? POLL_MS : false,
  })
}

// ONIX N-007: one mutation object is shared across every row (a plain `mutate`
// re-fires while the previous call for the SAME row is still in flight — the
// test fires two clicks synchronously, before `isPending` can re-render the
// button). A row-id-keyed latch (ref, written in the handler only) drops the
// second call; the mutation's own `isPending` still disables the row button.
function useLatchedMutation(mutationFn: (id: string) => Promise<unknown>, invalidate: () => void) {
  const inFlight = useRef<Set<string>>(new Set())
  const mutation = useMutation({
    mutationFn,
    onSuccess: invalidate,
    onSettled: (_data, _err, id) => { inFlight.current.delete(id as string) },
  })
  const mutate = (id: string) => {
    if (inFlight.current.has(id)) return
    inFlight.current.add(id)
    mutation.mutate(id)
  }
  return { ...mutation, mutate }
}

// The three mutating actions + cancel, each invalidating both queries so the
// row list and the stats strip settle back to the server's own state.
export function useWaWebQueueActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['wa-web-queue'] })
    qc.invalidateQueries({ queryKey: ['wa-web-queue-stats'] })
  }
  const sendNow = useLatchedMutation((id: string) => api.post(`/whatsapp-web/queue/${id}/send-now`), invalidate)
  const pause = useLatchedMutation((id: string) => api.post(`/whatsapp-web/queue/${id}/pause`), invalidate)
  const retry = useLatchedMutation((id: string) => api.post(`/whatsapp-web/queue/${id}/retry`), invalidate)
  const cancel = useLatchedMutation((id: string) => api.delete(`/whatsapp-web/queue/${id}`), invalidate)
  return { sendNow, pause, retry, cancel }
}
