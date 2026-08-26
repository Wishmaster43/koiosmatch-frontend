/**
 * useApplicationLite — minimal application identity fetch for the second-screen
 * notes popout (A-popout-1, mirrors useVacancyLite/useCustomerLite). `GET
 * /applications/{id}` is the only single-record endpoint the API exposes, so
 * this reuses it but reads only the CANDIDATE name (the popout header shows
 * "whose notes these are", same as every other entity popout) plus the vacancy
 * title as a secondary identity line — never the full mapApplicationDetail
 * transform (interviews/appointments/timeline/…), which the notes-only popout
 * doesn't need. React Query (house standard for server state, §1) gives this
 * cache/dedupe/signal-cancel for free.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface ApplicationLite { id: string; candidateName: string; vacancyTitle: string; initials: string }

// The subset of the raw application resource this hook actually reads.
interface RawApplicationLite {
  id?: string | number
  candidate?: { name?: string; first_name?: string; last_name?: string }
  candidate_name?: string
  vacancy?: { title?: string }
  vacancy_title?: string
}

// Minimal candidate name + vacancy title for the notes popout header, reusing the full detail endpoint but never its heavy transform (see file header).
export function useApplicationLite(id: string | undefined) {
  const { data: application = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['applications', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<ApplicationLite> => {
      const raw = unwrap<RawApplicationLite>(await api.get(`/applications/${id}`, { signal }))
      const candidateName = raw.candidate?.name
        || [raw.candidate?.first_name, raw.candidate?.last_name].filter(Boolean).join(' ')
        || raw.candidate_name || '?'
      const vacancyTitle = raw.vacancy?.title || raw.vacancy_title || ''
      return { id: String(raw.id ?? id), candidateName, vacancyTitle, initials: initialsOf(candidateName) }
    },
  })
  return { application, loading, error, reload }
}
