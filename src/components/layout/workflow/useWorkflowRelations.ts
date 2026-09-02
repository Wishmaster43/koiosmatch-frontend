/**
 * useWorkflowRelations — WF-RELATIONS-FE-1's data hook: fetches the parent/child
 * tree for one workflow (GET /workflows/{id}/relations → { parents, children })
 * and exposes a minimal active-toggle mutation. The toggle sends ONLY
 * `{ status, active }` — this hook never loaded the related workflow's steps,
 * and the backend contract is explicit ("PUT /workflows/{workflow} — update
 * fields and, IF PROVIDED, replace all steps"), so omitting `steps` here is
 * safe and never wipes the related workflow's graph.
 *
 * K-254 (WF-RELATIONS-FE-2): the same response also carries `calls` (workflow_call
 * targets, with `mode`), `called_by` and an always-present `tree` (root node, depth
 * capped at 5, cycle/truncated flagged server-side) — read tolerantly, same
 * missing-means-empty contract as parents/children. useWorkflowChildren is removed:
 * the server-built tree drives the whole branch, no more per-node lazy fetch.
 */
import { useEffect, useState, useCallback } from 'react'
import api, { unwrap } from '@/lib/api'
import type { WorkflowRelation } from '@/types/workflow'

// Recursively patches the matching node's status inside a server-built tree
// (pure/module-scope so toggleStatus below needs no extra hook dependency).
function patchTreeStatus(node: WorkflowRelation | null, id: string | number, status?: string): WorkflowRelation | null {
  if (!node) return node
  const next: WorkflowRelation = String(node.id) === String(id) ? { ...node, status } : node
  if (!next.children?.length) return next
  return { ...next, children: next.children.map(c => patchTreeStatus(c, id, status) as WorkflowRelation) }
}

// Loads a workflow's parent/child relations and exposes the active-toggle mutation
// described in the module doc comment above (never touches the related workflow's own steps).
export function useWorkflowRelations(workflowId?: string | number) {
  const [parents,  setParents]  = useState<WorkflowRelation[]>([])
  const [children, setChildren] = useState<WorkflowRelation[]>([])
  const [calls,    setCalls]    = useState<WorkflowRelation[]>([])
  const [calledBy, setCalledBy] = useState<WorkflowRelation[]>([])
  const [tree,     setTree]     = useState<WorkflowRelation | null>(null)
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
        const body = unwrap<{
          parents?: WorkflowRelation[]; children?: WorkflowRelation[]
          calls?: WorkflowRelation[]; called_by?: WorkflowRelation[]; tree?: WorkflowRelation | null
        }>(res) ?? {}
        setParents(body.parents ?? [])
        setChildren(body.children ?? [])
        setCalls(body.calls ?? [])
        setCalledBy(body.called_by ?? [])
        setTree(body.tree ?? null)
      })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [workflowId, tick])

  // Optimistic active/inactive toggle — the existing workflow update call
  // (PUT /workflows/{id}), rolled back on failure (mirrors useWorkflowsData's
  // own handleToggleStatus rollback pattern). K-254: a row can appear in
  // MULTIPLE places at once (the flat parents/children/calls/called_by lists
  // AND the server-built tree), so every list that may hold this id is
  // patched together — never just the one the caller happened to render from.
  const toggleStatus = useCallback(async (row: WorkflowRelation) => {
    const prevStatus = row.status
    const nextStatus = prevStatus === 'active' ? 'inactive' : 'active'
    const apply = (status?: string) => {
      const patchList = (r: WorkflowRelation) => r.id === row.id ? { ...r, status } : r
      setParents(prev => prev.map(patchList))
      setChildren(prev => prev.map(patchList))
      setCalls(prev => prev.map(patchList))
      setCalledBy(prev => prev.map(patchList))
      setTree(prev => patchTreeStatus(prev, row.id, status))
    }
    apply(nextStatus)
    try {
      await api.put(`/workflows/${row.id}`, { status: nextStatus, active: nextStatus === 'active' })
    } catch {
      apply(prevStatus)
    }
  }, [])

  return { parents, children, calls, calledBy, tree, loading, error, retry, toggleStatus }
}
