/**
 * useOutreachActivity — the bellijst (campaign) audit trail: who changed what, when.
 * Fetches GET /outreach-campaigns/{id}/activity (MEASURED: declared in
 * routes/api/tenant/tasks-outreach.php under permission:outreach.view, served by
 * OutreachCampaignController::activityLog → the SHARED LogsEntityActivity trait the
 * customer/candidate/vacancy feeds use, so the entry shape is identical). The model
 * carries AuditsChanges (measured in app/Models/OutreachCampaign.php), so entries
 * arrive with a field-level `changes` diff bag. Mirrors useVacancyActivity /
 * useOpportunityActivity so every entity's changelog behaves the same (§3A).
 */
import { useState, useEffect } from 'react'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

/** One entry of the shared feed (LogsEntityActivity::formatActivityEntry). */
export interface OutreachActivityEvent {
  id?: Id
  causer_name?: string
  created_at?: string
  description?: string
  log_name?: string
  // Spatie event verb (created/updated/deleted) — drives the friendly action line.
  event?: string
  // CHANGELOG-3: field-level diff — `attributes` = new values, `old` = previous ones.
  // The resource exposes it as `changes`; `properties` stays for the legacy key.
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown>; [k: string]: unknown }
  properties?: { attributes?: Record<string, unknown>; old?: Record<string, unknown>; [k: string]: unknown }
  [k: string]: unknown
}

export function useOutreachActivity(id?: Id | null): { items: OutreachActivityEvent[]; loading: boolean; error: boolean } {
  const [items,   setItems]   = useState<OutreachActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(false)

  // Entity-keyed load with an AbortController (§9) — a fast id switch must never let
  // the previous campaign's response win.
  useEffect(() => {
    if (!id) { setItems([]); return }
    const ctrl = new AbortController()
    setLoading(true); setError(false)
    api.get(`/outreach-campaigns/${id}/activity`, { signal: ctrl.signal })
      .then(res => setItems(unwrapList<OutreachActivityEvent>(res).rows))
      .catch(err => {
        if (err?.code === 'ERR_CANCELED') return
        // 404 = this id no longer resolves in the tenant (hard-deleted / stale drawer
        // id) → render the calm empty state, not a failure banner. Every other failure
        // (incl. a no-response network error) IS an error, mirroring the sibling hooks.
        if (err?.response?.status !== 404) setError(true)
        setItems([])
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    return () => ctrl.abort()
  }, [id])

  return { items, loading, error }
}
