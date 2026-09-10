/**
 * useEntityLite — generic minimal entity fetch for second-screen popouts, reusing
 * full detail endpoints but reading only needed fields via a mapper. Replaces
 * useApplicationLite + useMatchLite with one composable hook (DRY-8, unit 8).
 * React Query (house standard for server state, §1) gives every caller
 * cache/dedupe/signal-cancel for free, which is why this reuses the full
 * detail endpoint rather than hand-rolling a fetch per entity.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

export interface EntityLiteBase {
  id: string
  initials: string
}

// Fetch from one API endpoint, unwrap raw data, apply a mapper to extract only what the caller needs.
export function useEntityLite<T extends EntityLiteBase>(
  path: string,
  mapper: (raw: unknown) => T,
  id: string | undefined,
) {
  const { data: entity = null, isLoading: loading, isError: error, refetch: reload } = useQuery({
    // Same key shape as the other lite hooks (['applications', id, 'lite']): prefix
    // invalidations match on the bare resource name, never on the leading slash.
    queryKey: [path.replace(/^\//, ''), id, 'lite'],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<T> => {
      const raw = unwrap(await api.get(`${path}/${id}`, { signal }))
      return mapper(raw)
    },
  })
  return { entity, loading, error, reload }
}
