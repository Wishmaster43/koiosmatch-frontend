/**
 * Shared query hooks.
 *
 * Centralises read-mostly GETs so they are fetched once and cached/deduped
 * across every component that needs them (instead of each page running its own
 * useEffect). Add new hooks here as pages migrate to React Query.
 */
import { useQuery } from '@tanstack/react-query'
import api, { getActiveTenantId, unwrapList } from './api'
import { useAuth } from '@/context/AuthContext'

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
// USERS-403-1 (Danny 19-09, console on #whatsapp and #candidates: "GET /users 403" for a
// recruiter, followed by "Maximum update depth exceeded"): GET /users is gated users.view, so a
// caller without it must not fire the query at all — and on any error `data` becomes undefined,
// which turned every `const { data: users = [] }` call site into a fresh array per render and
// looped the filter registration. Two guards: the query is enabled only with the permission,
// and `data` is always the stable empty array when the server gave nothing.
export function useUsers() {
  const tenantId = getActiveTenantId() ?? 'none'
  const auth = useAuth()
  const allowed = typeof auth?.hasPermission === 'function' ? auth.hasPermission('users.view') : true
  const query = useQuery({
    queryKey: ['users', tenantId],
    queryFn: async ({ signal }) => unwrapList(await api.get('/users', { signal })).rows,
    placeholderData: EMPTY_USERS,
    enabled: allowed,
    retry: false,
  })
  return { ...query, data: query.data ?? EMPTY_USERS }
}

/**
 * Narrow id+name staff lookup for settings-only screens (DL-08/WFB-11).
 *
 * GET /users itself is gated `page.users`+`users.view` (full staff rows), which a
 * genuinely settings-only CUSTOM role lacks — `GET /users/options` inherits the
 * smaller `users.view,settings.view` (ANY-of) gate, so a settings picker (owner/
 * assignee/recipient) keeps working for that role. Entity pages keep useUsers().
 */
export function useUserOptions() {
  const tenantId = getActiveTenantId() ?? 'none'
  return useQuery({
    queryKey: ['users-options', tenantId],
    queryFn: async ({ signal }) => unwrapList(await api.get('/users/options', { signal })).rows,
    placeholderData: EMPTY_USERS,
  })
}
