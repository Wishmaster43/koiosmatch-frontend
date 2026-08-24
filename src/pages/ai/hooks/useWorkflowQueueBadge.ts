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

function total(counts: QueueCounts): number {
  return (counts.pending ?? 0) + (counts.waiting ?? 0) + (counts.scheduled_today ?? 0) + (counts.retrying ?? 0)
}

export function useWorkflowQueueBadge(workflowId?: string) {
  const [count, setCount] = useState<number | null>(null)

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
