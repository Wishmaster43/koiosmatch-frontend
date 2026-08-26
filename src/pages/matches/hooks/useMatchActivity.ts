/**
 * useMatchActivity — the match audit trail (who changed what, when). Thin typed
 * wrapper around the shared useEntityActivity (src/hooks/) — fetches
 * GET /matches/{id}/activity. Mirrors useApplicationActivity / useVacancyActivity
 * so every entity's changelog behaves identically (§3A).
 */
import { useEntityActivity } from '@/hooks/useEntityActivity'
import type { EntityActivityEvent, UseEntityActivityResult } from '@/hooks/useEntityActivity'
import type { Id } from '@/types/common'

export type MatchActivityEvent = EntityActivityEvent

// Fetches the match's audit trail (see file docblock above).
export function useMatchActivity(id?: Id): UseEntityActivityResult<MatchActivityEvent> {
  return useEntityActivity<MatchActivityEvent>('matches', id)
}
