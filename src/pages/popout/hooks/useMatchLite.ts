/**
 * useMatchLite — minimal match identity fetch for the second-screen notes
 * popout (NOTITIE-POPOUT-EDIT-1 generalisation, mirrors useApplicationLite).
 * `GET /matches/{id}` is the only single-record endpoint the API exposes, so
 * this reuses it via the shared useEntityLite (DRY-8, unit 8) but reads only
 * the candidate name (the popout header shows "whose notes these are", same
 * as every other entity popout) plus the vacancy title as a secondary
 * identity line — never the full match detail mapper.
 */
import { useEntityLite } from '@/hooks/useEntityLite'
import { liteRecordHeader } from './liteHeader'

// Minimal candidate name + vacancy title for the notes popout header.
export function useMatchLite(id: string | undefined) {
  const { entity: match, loading, error, reload } = useEntityLite('/matches', liteRecordHeader, id)
  return { match, loading, error, reload }
}
