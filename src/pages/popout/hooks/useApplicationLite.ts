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
import { initialsOf } from '@/lib/initials'

export interface ApplicationLite { id: string; candidateName: string; vacancyTitle: string; initials: string }

// The subset of the raw application resource this mapper reads.
interface RawApplicationLite {
  id?: string | number
  candidate?: { name?: string; first_name?: string; last_name?: string }
  candidate_name?: string
  vacancy?: { title?: string }
  vacancy_title?: string
}

// Mapper for useEntityLite: extract candidate name + vacancy title.
const mapApplicationLite = (raw: unknown): ApplicationLite => {
  const r = raw as RawApplicationLite
  const candidateName = r.candidate?.name
    || [r.candidate?.first_name, r.candidate?.last_name].filter(Boolean).join(' ')
    || r.candidate_name || '?'
  const vacancyTitle = r.vacancy?.title || r.vacancy_title || ''
  return { id: String(r.id ?? ''), candidateName, vacancyTitle, initials: initialsOf(candidateName) }
}

// Minimal candidate name + vacancy title for the notes popout header, reusing the full detail endpoint.
export function useApplicationLite(id: string | undefined) {
  const { entity: application, loading, error, reload } = useEntityLite('/applications', mapApplicationLite, id)
  return { application, loading, error, reload }
}
