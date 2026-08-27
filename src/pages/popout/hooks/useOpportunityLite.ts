/**
 * useOpportunityLite — minimal opportunity identity fetch for the second-screen
 * notes popout (NOTITIE-POPOUT-EDIT-1 generalisation, mirrors useVacancyLite).
 * `GET /opportunities/{id}` is the only single-record endpoint the API exposes,
 * so this reuses it but reads only the title off the raw response — never the
 * full opportunity detail mapper (customer/value/…).
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface OpportunityLite { id: string; name: string; initials: string }

// The subset of the raw opportunity resource this hook actually reads.
interface RawOpportunityLite { id?: string | number; title?: string; name?: string }

// Minimal opportunity identity (id/name/initials) for the second-screen popout's title/header.
export function useOpportunityLite(id: string | undefined) {
  const { data: opportunity = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['opportunities', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<OpportunityLite> => {
      const raw = unwrap<RawOpportunityLite>(await api.get(`/opportunities/${id}`, { signal }))
      const name = raw.title || raw.name || '?'
      return { id: String(raw.id ?? id), name, initials: initialsOf(name) }
    },
  })
  return { opportunity, loading, error, reload }
}
