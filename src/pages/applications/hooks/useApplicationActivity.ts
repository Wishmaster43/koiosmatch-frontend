/**
 * useApplicationActivity — the application audit trail (who changed what, when).
 * Thin typed wrapper around the shared useEntityActivity (src/hooks/) — fetches
 * GET /applications/{id}/activity (EntityChangelogController::application).
 * Mirrors useVacancyActivity / useMatchActivity so every entity's changelog
 * behaves identically (§3A).
 */
import { useEntityActivity } from '@/hooks/useEntityActivity'
import type { EntityActivityEvent, UseEntityActivityResult } from '@/hooks/useEntityActivity'
import type { Id } from '@/types/common'

export interface ApplicationActivityEvent extends EntityActivityEvent {
  // Field-level old→new diff bag (EntityChangelogController::formatActivityEntry) —
  // used to suppress a stage-only entry already covered by the Timeline tab.
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown> }
}

// Fetches the application's audit trail (see file docblock above).
export function useApplicationActivity(id?: Id): UseEntityActivityResult<ApplicationActivityEvent> {
  return useEntityActivity<ApplicationActivityEvent>('applications', id)
}
