/**
 * useCouplingErrors — loads the backoffice coupling-failure rows behind the
 * dashboard `coupling_errors` KPI. GET /external-id-mappings/failures (K-173
 * fase 5): one row per mapping whose LAST sync attempt failed, newest first.
 * The endpoint documents its 401 shape only (no 2xx schema in api-generated.ts
 * yet — see CLAUDE.md §10 gradual type-gen note), so the success row shape is
 * hand-written here from the measured contract in the endpoint's own docblock.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'

// One failing mapping row (measured contract, api-generated.ts:10371-10378).
export interface CouplingErrorRow {
  entity_type: string
  entity_id: string
  entity_label: string | null
  system: 'shiftmanager' | 'helloflex'
  error: string
  synced_at: string | null
}

export function useCouplingErrors() {
  const query = useQuery({
    queryKey: ['external-id-mappings', 'failures'],
    queryFn: async () => unwrapList<CouplingErrorRow>(await api.get('/external-id-mappings/failures')).rows,
  })
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  }
}
