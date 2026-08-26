/**
 * useWorkflowTemplates — data layer for the workflow template library (K0):
 * GET /workflow-templates, filtered server-side via ?category= when a category
 * folder is selected (koiosmatch-api COORDINATION-LOG 2026-08-06: "workflow-
 * templates dragen nu category ('koios_ai' voor de zes actie-templates); de
 * templatelijst filtert op ?category=" — workflow templates now carry a category
 * ('koios_ai' for the six action templates); the template list filters on
 * ?category=). Picking a category re-fetches rather
 * than filtering the already-loaded list client-side, so the server contract is
 * exercised for real every time — not just approximated in the browser.
 */
import { useEffect, useState } from 'react'
import api, { unwrapList } from '@/lib/api'

// A workflow template (blueprint a new workflow can start from).
export interface WorkflowTemplate {
  id: string | number
  name: string
  description?: string | null
  category?: string | null
  steps?: unknown[]
  [k: string]: unknown
}

// The one system category every tenant is seeded with (koiosmatch-api K0) — a
// stable identifier, not a tenant-configurable lookup, exactly like the
// 'unassigned' sentinel folder id already hardcoded in WorkflowFolderSidebar.
export const KOIOS_AI_CATEGORY = 'koios_ai'

// Fetches the template list, refetching whenever the panel opens or the
// selected category changes. `open` gates the fetch so a mounted-but-closed
// library never fires a request the user can't see the result of.
export function useWorkflowTemplates(open: boolean) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [category, setCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Refetches on open/category change (see the comment above); alive-guarded so a
  // closed panel or a fast category switch never lets a stale response land.
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true); setError(false)
    api.get('/workflow-templates', { params: category ? { category } : {} })
      .then((res) => { if (alive) setTemplates(unwrapList<WorkflowTemplate>(res).rows) })
      .catch(() => { if (alive) setError(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [open, category])

  return { templates, category, setCategory, loading, error }
}
