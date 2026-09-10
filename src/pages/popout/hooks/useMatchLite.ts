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
import { initialsOf } from '@/lib/initials'

export interface MatchLite { id: string; candidateName: string; vacancyTitle: string; initials: string }

// The subset of the raw match resource this mapper reads.
interface RawMatchLite {
  id?: string | number
  candidate?: { name?: string; first_name?: string; last_name?: string }
  candidate_name?: string
  vacancy?: { title?: string }
  vacancy_title?: string
}

// Mapper for useEntityLite: extract candidate name + vacancy title.
const mapMatchLite = (raw: unknown): MatchLite => {
  const r = raw as RawMatchLite
  const candidateName = r.candidate?.name
    || [r.candidate?.first_name, r.candidate?.last_name].filter(Boolean).join(' ')
    || r.candidate_name || '?'
  const vacancyTitle = r.vacancy?.title || r.vacancy_title || ''
  return { id: String(r.id ?? ''), candidateName, vacancyTitle, initials: initialsOf(candidateName) }
}

// Minimal candidate name + vacancy title for the notes popout header.
export function useMatchLite(id: string | undefined) {
  const { entity: match, loading, error, reload } = useEntityLite('/matches', mapMatchLite, id)
  return { match, loading, error, reload }
}
