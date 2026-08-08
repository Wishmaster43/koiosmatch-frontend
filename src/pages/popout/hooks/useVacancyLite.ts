/**
 * useVacancyLite — minimal vacancy identity fetch for the second-screen notes
 * popout (F5-uitbreiding, mirrors useCandidateLite). `GET /vacancies/{id}` is the
 * only single-record endpoint the API exposes today, so this reuses it but
 * deliberately SKIPS the full `mapVacancyDetail` transform (owner/customer/
 * requirements/documents/…) — it only reads the title off the raw response so
 * the popout window's title/header never pays for mapping the whole vacancy just
 * to show two words. React Query (house standard for server state, §1) gives
 * this cache/dedupe/signal-cancel for free.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface VacancyLite { id: string; name: string; initials: string }

// The subset of the raw vacancy resource this hook actually reads. A vacancy has
// no "name" field — its identity is its `title`.
interface RawVacancyLite { id?: string | number; title?: string }

export function useVacancyLite(id: string | undefined) {
  const { data: vacancy = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['vacancies', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<VacancyLite> => {
      const raw = unwrap<RawVacancyLite>(await api.get(`/vacancies/${id}`, { signal }))
      const name = raw.title || '?'
      return { id: String(raw.id ?? id), name, initials: initialsOf(name) }
    },
  })
  return { vacancy, loading, error, reload }
}
