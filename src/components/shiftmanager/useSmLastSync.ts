/**
 * useSmLastSync — the Shiftmanager mirror's last sync timestamp, so the charts can
 * show how old the data is. Reads GET /dashboard's sync_sources (already the source
 * of truth on the main dashboard) and picks the Shiftmanager/planning entry. Cached.
 */
import { useQuery } from '@tanstack/react-query'
import { heavyGet } from '@/lib/heavyGet'

interface SyncSource { system?: string; label?: string; last_synced_at?: string | null }

// Cached lookup of the Shiftmanager mirror's own sync timestamp out of the
// dashboard's shared sync_sources list, matched loosely since tenant labels vary.
export function useSmLastSync(enabled = true): string | null {
  const { data } = useQuery({
    queryKey: ['dashboard', 'sync-sources'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const sources = (await heavyGet('/dashboard', { signal })).data?.sync_sources ?? []
      return (Array.isArray(sources) ? sources : []) as SyncSource[]
    },
  })
  // Pick the Shiftmanager / planning source (tenant labels vary → match loosely).
  const src = (data ?? []).find(s => /shift|planning|^sm/i.test(`${s.system ?? ''} ${s.label ?? ''}`))
  return src?.last_synced_at ?? null
}
