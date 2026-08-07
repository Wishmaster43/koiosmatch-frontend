/**
 * useCandidateLite — minimal candidate identity fetch for the second-screen notes
 * popout (NOTITIE-POPOUT-1 F5). `GET /candidates/{id}` is the only single-record
 * endpoint the API exposes today (no lighter "name-only" route exists), so this
 * reuses it but deliberately SKIPS the full `mapCandidate` transform — it only
 * reads the name fields off the raw response, same fallback chain mapCandidate
 * itself uses, so the popout window's title/header never pays for mapping the
 * whole candidate (documents, experience, matches, …) just to show two words.
 * React Query (house standard for server state, §1) gives this cache/dedupe/
 * signal-cancel for free.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'
import { initialsOf } from '@/lib/initials'

export interface CandidateLite { id: string; name: string; initials: string }

// The subset of the raw candidate resource this hook actually reads.
interface RawCandidateLite {
  id?: string | number
  name?: string
  full_name?: string
  firstname?: string
  lastname?: string
  first_name?: string
  last_name?: string
}

// Same name-derivation fallback chain as mapCandidate.ts (data/mapCandidate.ts) —
// duplicated on purpose, not imported, so this stays a genuinely light fetch.
const nameOf = (c: RawCandidateLite): string =>
  c.name || c.full_name
  || [c.firstname, c.lastname].filter(Boolean).join(' ')
  || [c.first_name, c.last_name].filter(Boolean).join(' ') || '?'

export function useCandidateLite(id: string | undefined) {
  const { data: candidate = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    queryKey: ['candidates', id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<CandidateLite> => {
      const raw = unwrap<RawCandidateLite>(await api.get(`/candidates/${id}`, { signal }))
      const name = nameOf(raw)
      return { id: String(raw.id ?? id), name, initials: initialsOf(name) }
    },
  })
  return { candidate, loading, error, reload }
}
