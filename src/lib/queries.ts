import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from './api'

/**
 * Shared query hooks.
 *
 * Centralises read-mostly GETs so they are fetched once and cached/deduped
 * across every component that needs them (instead of each page running its own
 * useEffect). Add new hooks here as pages migrate to React Query.
 */

// Stable empty default. Without it, `data` is undefined while loading, and each
// `const { data = [] } = useUsers()` call site would create a fresh [] every render —
// feeding memo/effect chains that loop setState (see useCandidatesData / RightPanelContext).
const EMPTY_USERS: unknown[] = []

/** Tenant users (owners/assignees). Cached + deduped app-wide. */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async ({ signal }) => unwrapList(await api.get('/users', { signal })).rows,
    placeholderData: EMPTY_USERS,
  })
}

/**
 * Total candidate count — the same source the Candidates table paginates over
 * (/candidates meta.total). per_page:1 keeps it cheap. Tenant-scoped: the cache
 * is cleared on a bureau switch (see AuthContext.setActiveTenant).
 */
export function useCandidateCount() {
  return useQuery({
    queryKey: ['candidates', 'count'],
    queryFn: async ({ signal }) => unwrapList(await api.get('/candidates', { params: { per_page: 1 }, signal })).total,
  })
}
