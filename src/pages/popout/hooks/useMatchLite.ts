/**
 * useMatchLite — minimal match identity fetch for the second-screen notes
 * popout (NOTITIE-POPOUT-EDIT-1 generalisation, mirrors useApplicationLite).
 * `GET /matches/{id}` is the only single-record endpoint the API exposes, so
 * this reuses it but reads only the candidate name (the popout header shows
 * "whose notes these are", same as every other entity popout) plus the vacancy
 * title as a secondary identity line — never the full match detail mapper.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface MatchLite { id: string; candidateName: string; vacancyTitle: string; initials: string }

// The subset of the raw match resource this hook actually reads.
interface RawMatchLite {
  id?: string | number
  candidate?: { name?: string; first_name?: string; last_name?: string }
  candidate_name?: string
  vacancy?: { title?: string }
  vacancy_title?: string
}

// Minimal candidate name + vacancy title for the notes popout header, mirroring useApplicationLite.
export function useMatchLite(id: string | undefined) {
  const { data: match = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['matches', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<MatchLite> => {
      const raw = unwrap<RawMatchLite>(await api.get(`/matches/${id}`, { signal }))
      const candidateName = raw.candidate?.name
        || [raw.candidate?.first_name, raw.candidate?.last_name].filter(Boolean).join(' ')
        || raw.candidate_name || '?'
      const vacancyTitle = raw.vacancy?.title || raw.vacancy_title || ''
      return { id: String(raw.id ?? id), candidateName, vacancyTitle, initials: initialsOf(candidateName) }
    },
  })
  return { match, loading, error, reload }
}
