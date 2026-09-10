/**
 * useApplicationLite — minimal application identity fetch for the second-screen
 * notes popout (A-popout-1, mirrors useVacancyLite/useCustomerLite). `GET
 * /applications/{id}` is the only single-record endpoint the API exposes, so
 * this reuses it via the shared useEntityLite (DRY-8, unit 8) but reads only the
 * CANDIDATE name (the popout header shows "whose notes these are", same as
 * every other entity popout) plus the vacancy title as a secondary identity
 * line — never the full mapApplicationDetail transform (interviews/appointments/
 * timeline/…), which the notes-only popout doesn't need.
 */
import { useEntityLite } from '@/hooks/useEntityLite'
import { liteRecordHeader } from './liteHeader'

// Minimal candidate name + vacancy title for the notes popout header, reusing the full detail endpoint.
export function useApplicationLite(id: string | undefined) {
  const { entity: application, loading, error, reload } = useEntityLite('/applications', liteRecordHeader, id)
  return { application, loading, error, reload }
}
