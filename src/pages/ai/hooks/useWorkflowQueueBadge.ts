/**
 * useWorkflowQueueBadge — WF-WACHTRIJ-FE-1's relations-tree badge: how many
 * queue entries (pending+waiting+scheduled+retrying) exist right now for ONE
 * workflow (K-171, GET /workflows/queue?workflow_id=). Renders NOTHING at 0 —
 * the badge only ever adds noise when there is something to see. A 403 (no
 * settings.view) degrades to "no count" silently, same as the main queue view.
 */
import { useEffect, useState } from 'react'
import api, { unwrap } from '@/lib/api'
import type { QueueSnapshot, QueueCounts } from './useWorkflowQueue'

// Sums the queue states that count as an outstanding entry for the badge.
function total(counts: QueueCounts): number {
  return (counts.pending ?? 0) + (counts.waiting ?? 0) + (counts.scheduled_today ?? 0) + (counts.retrying ?? 0)
}

// Fetches one workflow's outstanding queue count and renders nothing at 0, so the badge never adds noise when there is nothing to see.
export function useWorkflowQueueBadge(workflowId?: string) {
  const [count, setCount] = useState<number | null>(null)

  // Fetches the queue count for this workflow whenever the id changes; an alive guard drops a stale response after a fast id switch or unmount.
  useEffect(() => {
    if (workflowId == null) { setCount(null); return }
    let alive = true
    api.get(`/workflows/queue?workflow_id=${encodeURIComponent(String(workflowId))}`)
      .then(res => { if (alive) setCount(total(unwrap<QueueSnapshot>(res)?.counts ?? {})) })
      .catch(() => { if (alive) setCount(null) })
    return () => { alive = false }
  }, [workflowId])

  return count
}
