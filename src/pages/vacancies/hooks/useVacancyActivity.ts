/**
 * useVacancyActivity — the vacancy audit trail (who changed what, when). Thin
 * typed wrapper around the shared useEntityActivity (src/hooks/) — fetches
 * GET /vacancies/{id}/activity (EntityChangelogController::vacancy). Mirrors
 * useApplicationActivity / useMatchActivity so every entity's changelog behaves
 * identically (§3A).
 */
import { useEntityActivity } from '@/hooks/useEntityActivity'
import type { EntityActivityEvent, UseEntityActivityResult } from '@/hooks/useEntityActivity'
import type { Id } from '@/types/common'

// DRY (CANDHOOKS r9): the changes/properties/event diff fields now live on the
// shared EntityActivityEvent (hooks/useEntityActivity) itself — this alias keeps
// the entity's own named type for callers/tests without redeclaring the fields.
export type VacancyActivityEvent = EntityActivityEvent

// Fetches the vacancy's audit trail (see file docblock above).
export function useVacancyActivity(id?: Id): UseEntityActivityResult<VacancyActivityEvent> {
  return useEntityActivity<VacancyActivityEvent>('vacancies', id)
}
