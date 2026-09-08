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
import type { Id } from '@/types/common'
import { useEntityActivity } from '@/hooks/useEntityActivity'

/** One entry of the shared feed (LogsEntityActivity::formatActivityEntry). */
export interface OutreachActivityEvent {
  id?: Id
  causer_name?: string
  // Koios-performed action label ("<name>-KoiosAI") — wins over causer_name when present.
  actor_label?: string
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

// Fetches one campaign's audit trail from the shared LogsEntityActivity feed, mirroring every other entity's changelog hook (see file header).
export function useOutreachActivity(id?: Id | null): { items: OutreachActivityEvent[]; loading: boolean; error: boolean } {
  const { items, loading, error } = useEntityActivity<OutreachActivityEvent>('outreach-campaigns', id ?? undefined)
  return { items, loading, error }
}
