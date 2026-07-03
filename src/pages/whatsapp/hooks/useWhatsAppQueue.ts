/**
 * useWhatsAppQueue — loads the WhatsApp-privé outbox + per-number stats (backend C-43).
 * Graceful: a failed/absent endpoint yields an empty queue + zero counts, so the tab and
 * the sidebar badge render calmly. `statsOnly` skips the list load — the sidebar only
 * needs the backlog count, not the rows.
 *
 * Contract: GET /whatsapp-web/queue → { data:[{id, candidate:{id,name},
 *   message_type:{value,label,color}, priority, status, attempts, scheduled_at, number_id,
 *   hold_reason}], meta } — hold_reason = WHY a message waits (WA-5): new_number_daily/
 *   hourly/weekly, rate_limit, priority_wait, scheduled, ready. (PII-arm: no phone/body.)
 *   GET /whatsapp-web/queue/stats → per number
 *   [{ number_id, label, rate_limit, in_queue, est_drain }]. Mutations gated messaging.manage.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'

export interface QueueItem {
  id: string | number
  candidate?: { id: string; name: string } | null
  message_type?: { value?: string; label?: string; color?: string | null } | null
  priority?: number | null
  status: string
  attempts?: number | null
  scheduled_at?: string | null
  number_id?: string | number | null
  // Why this message is still waiting (BE WA-5): explains the cap/hold to the recruiter.
  hold_reason?: string | null
}
// Stats are per-number: the drain budget + backlog + estimated drain time.
export interface QueueNumberStats {
  number_id: string | number
  label?: string
  rate_limit?: number
  in_queue?: number
  est_drain?: string | number
}
export type QueueAction = 'send-now' | 'pause' | 'retry' | 'cancel'

export function useWhatsAppQueue({ enabled = true, statsOnly = false } = {}) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [stats, setStats] = useState<QueueNumberStats[]>([])
  const [phase, setPhase] = useState<'loading' | 'error' | 'ready'>('loading')

  // One load = queue list (unless statsOnly) + per-number stats; both fail-soft to empty.
  const load = useCallback((signal?: AbortSignal) => {
    if (!enabled) { setItems([]); setStats([]); setPhase('ready'); return }
    setPhase('loading')
    const listP = statsOnly
      ? Promise.resolve([] as QueueItem[])
      : api.get('/whatsapp-web/queue', { signal }).then(r => r.data?.data ?? r.data ?? []).catch(() => [])
    const statsP = api.get('/whatsapp-web/queue/stats', { signal }).then(r => r.data?.data ?? r.data ?? []).catch(() => [])
    Promise.all([listP, statsP]).then(([list, s]) => {
      setItems(Array.isArray(list) ? list : [])
      setStats(Array.isArray(s) ? s : (s?.data ?? []))
      setPhase('ready')
    }).catch(() => setPhase('ready'))
  }, [enabled, statsOnly])

  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort() }, [load])

  // Row action — send-now/pause/retry via POST, cancel via soft DELETE. Refresh after.
  const act = useCallback(async (id: QueueItem['id'], verb: QueueAction) => {
    try {
      if (verb === 'cancel') await api.delete(`/whatsapp-web/queue/${id}`)
      else await api.post(`/whatsapp-web/queue/${id}/${verb}`)
    } catch { /* noop */ }
    load()
  }, [load])

  // Badge = queued backlog (sum of per-number in_queue) + failed (from the loaded list).
  const inQueue = stats.reduce((n, x) => n + (Number(x.in_queue) || 0), 0)
  const failed = items.filter(i => i.status === 'failed').length
  return { items, stats, inQueue, failed, count: inQueue + failed, phase, reload: () => load(), act }
}
