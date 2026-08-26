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

export interface VacancyActivityEvent extends EntityActivityEvent {
  // CHANGELOG-3: field-level diff (Spatie Activitylog shape) — `attributes` = the new
  // values, `old` = the previous values; the changelog tab renders one "field: old →
  // new" row per change. The current backend resource exposes this as `changes`
  // (`properties` kept for the legacy key, same as the candidate/opportunity feeds).
  properties?: { attributes?: Record<string, unknown>; old?: Record<string, unknown>; [k: string]: unknown }
  changes?: { attributes?: Record<string, unknown>; old?: Record<string, unknown>; [k: string]: unknown }
  // Spatie event verb (created/updated/deleted/restored) — drives the friendly action line.
  event?: string
}

// Fetches the vacancy's audit trail (see file docblock above).
export function useVacancyActivity(id?: Id): UseEntityActivityResult<VacancyActivityEvent> {
  return useEntityActivity<VacancyActivityEvent>('vacancies', id)
}
