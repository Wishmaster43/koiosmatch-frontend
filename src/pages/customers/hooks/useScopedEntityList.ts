/**
 * useScopedEntityList — generic GET <endpoint>?<paramName>=<id> fetch for the
 * department/location scoped sub-tabs (Vacatures/Matches, SCOPED-LIST-TAB-1).
 * ONE hook backs all four combinations (§3A: config-driven, never forked per
 * entity) — VacancyQuery/MatchController both validate `customer_location_id`/
 * `customer_department_id` as a SINGLE uuid (not the bracketed array form
 * `customer_id` uses), so the param always carries one bare id.
 *
 * An id outside the caller's branch grant 404s server-side (LOC-DEPT-TAB-1
 * guard: the sub-row resolves first, then its parent customer through
 * Customer::findOrFail) — react-query's default retry already skips 4xx
 * (lib/queryClient.ts), so that 404 surfaces as `error: true` here, the real
 * ERROR state, never a silently empty list.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { Id } from '@/types/common'

export function useScopedEntityList<T>(
  queryKey: string,
  endpoint: string,
  paramName: string,
  id: Id | undefined,
  mapRow: (raw: Record<string, unknown>) => T,
) {
  const { data = [], isLoading: loading, isError: error } = useQuery({
    queryKey: [queryKey, endpoint, paramName, id],
    enabled: !!id,
    queryFn: async ({ signal }): Promise<T[]> =>
      unwrapList<Record<string, unknown>>(
        await api.get(endpoint, { params: { [paramName]: id, per_page: 100 }, signal }),
      ).rows.map(mapRow),
  })
  return { rows: data, loading, error }
}
