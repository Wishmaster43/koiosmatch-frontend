/**
 * useOpportunityActivity — the opportunity audit trail (who changed what, when).
 * Fetches GET /opportunities/{id}/activity (the controller already logs via
 * activity('opportunities')). A 404 = read endpoint not built yet → treat as empty
 * (calm), not a hard error. Mirrors useCandidateActivity.
 */
import type { Id } from '@/types/common'
import { useEntityActivity } from '@/hooks/useEntityActivity'

export interface OpportunityActivityEvent {
  id?: Id
  causer_name?: string
  // Koios-performed action label ("<name>-KoiosAI") — wins over causer_name when present.
  actor_label?: string
  created_at?: string
  description?: string
  log_name?: string
  ip?: string
  [k: string]: unknown
}

// Fetches one opportunity's audit trail; a 404 (read endpoint not built yet for this tenant) degrades to a calm empty list, not an error.
export function useOpportunityActivity(id?: Id): { items: OpportunityActivityEvent[]; loading: boolean; error: boolean } {
  const { items, loading, error } = useEntityActivity<OpportunityActivityEvent>('opportunities', id)
  return { items, loading, error }
}
