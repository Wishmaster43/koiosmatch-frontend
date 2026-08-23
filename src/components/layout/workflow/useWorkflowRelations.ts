/**
 * useWorkflowRelations — WF-RELATIONS-FE-1's data hook: fetches the parent/child
 * tree for one workflow (GET /workflows/{id}/relations → { parents, children })
 * and exposes a minimal active-toggle mutation. The toggle sends ONLY
 * `{ status, active }` — this hook never loaded the related workflow's steps,
 * and the backend contract is explicit ("PUT /workflows/{workflow} — update
 * fields and, IF PROVIDED, replace all steps"), so omitting `steps` here is
 * safe and never wipes the related workflow's graph.
 */
import { useEffect, useState, useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import type { WorkflowRelation } from '@/types/workflow'

export function useWorkflowRelations(workflowId?: string | number) {
  const [parents,  setParents]  = useState<WorkflowRelation[]>([])
  const [children, setChildren] = useState<WorkflowRelation[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)
  const [tick,     setTick]     = useState(0)
  const retry = useCallback(() => setTick(v => v + 1), [])

  // Load the tree; empty on failure, never fabricated (four UI states, §3).
  useEffect(() => {
    if (workflowId == null) { setLoading(false); return }
    let alive = true
    setLoading(true); setError(false)
    api.get(`/workflows/${workflowId}/relations`)
      .then(res => {
        if (!alive) return
        const body = unwrap<{ parents?: WorkflowRelation[]; children?: WorkflowRelation[] }>(res) ?? {}
        setParents(body.parents ?? [])
        setChildren(body.children ?? [])
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [workflowId, tick])

  // Optimistic active/inactive toggle — the existing workflow update call
  // (PUT /workflows/{id}), rolled back on failure (mirrors useWorkflowsData's
  // own handleToggleStatus rollback pattern).
  const toggleStatus = useCallback(async (row: WorkflowRelation, list: 'parents' | 'children') => {
    const prevStatus = row.status
    const nextStatus = prevStatus === 'active' ? 'inactive' : 'active'
    const setList = list === 'parents' ? setParents : setChildren
    setList(prev => prev.map(r => r.id === row.id ? { ...r, status: nextStatus } : r))
    try {
      await api.put(`/workflows/${row.id}`, { status: nextStatus, active: nextStatus === 'active' })
    } catch {
      setList(prev => prev.map(r => r.id === row.id ? { ...r, status: prevStatus } : r))
    }
  }, [])

  return { parents, children, loading, error, retry, toggleStatus }
}
