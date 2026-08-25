/**
 * Shared query hooks.
 *
 * Centralises read-mostly GETs so they are fetched once and cached/deduped
 * across every component that needs them (instead of each page running its own
 * useEffect). Add new hooks here as pages migrate to React Query.
 */
import { useQuery } from '@tanstack/react-query'
import api, { getActiveTenantId, unwrapList } from './api'

// Stable empty default. Without it, `data` is undefined while loading, and each
// `const { data = [] } = useUsers()` call site would create a fresh [] every render —
// feeding memo/effect chains that loop setState (see useCandidatesData / RightPanelContext).
const EMPTY_USERS: unknown[] = []

/**
 * Tenant users (owners/assignees). Cached + deduped app-wide.
 *
 * Keyed by the active tenant id: without it, a super-admin switching bureaus
 * mid-session could get served the PREVIOUS tenant's user list from cache in
 * every owner/recruiter picker (setActiveTenant already clears+reloads, but the
 * key itself must be tenant-scoped so this holds even if that safety net ever
 * changes).
 */
export function useUsers() {
  const tenantId = getActiveTenantId() ?? 'none'
  return useQuery({
    queryKey: ['users', tenantId],
    queryFn: async ({ signal }) => unwrapList(await api.get('/users', { signal })).rows,
    placeholderData: EMPTY_USERS,
  })
}
