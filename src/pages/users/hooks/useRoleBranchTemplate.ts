/**
 * useRoleBranchTemplate — read-only preview of a role's branch TEMPLATE (GET
 * /roles/{id}/branches). POST /users copies this exact set as a fresh user's
 * starting branches (USERS-ROLES-LOC-1), so NewUserModal shows it the moment a
 * role is picked — "what will this person start with". Per-role, cacheable
 * lookup → react-query (K-33), mirrors useLocations.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrapList } from '@/lib/api'
import type { BranchRow } from '../usersParts'

export function useRoleBranchTemplate(roleId: string | number | null | undefined) {
  const hasRole = roleId != null && roleId !== ''
  const { data, isLoading } = useQuery({
    queryKey: ['roles', roleId, 'branches'],
    // Only fetch once a role is actually picked — `enabled` guards the id.
    queryFn: async ({ signal }) => unwrapList<BranchRow>(await api.get(`/roles/${roleId}/branches`, { signal })).rows,
    enabled: hasRole,
  })
  return { branches: hasRole ? data ?? [] : [], loading: hasRole && isLoading }
}
