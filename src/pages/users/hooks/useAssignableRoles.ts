/**
 * useAssignableRoles — the roles a tenant admin may hand a new/existing user
 * (GET /roles), replacing the old hardcoded ROLES literal in NewUserModal
 * (LOOKUP-GAP-1a). Custom tenant roles (backoffice/manager/recruiter/…) come
 * back exactly like the seeded ones; the backend already excludes super_admin,
 * filtered again here for defense in depth (never trust the client is the only
 * gate, §7). Server state → react-query (K-33), same lookup shape as useLocations.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// A role option as GET /roles returns it (RoleController::index) — id/name plus
// the appearance fields the settings screen manages (colour/icon), unused here
// beyond labeling but kept so a future chip-style renderer doesn't need a refetch.
export interface AssignableRole {
  id: string | number
  name: string
  color?: string | null
  icon?: string | null
}

export function useAssignableRoles() {
  const { data, isLoading } = useQuery({
    queryKey: ['roles', 'assignable'],
    queryFn: async ({ signal }) => {
      const res = await api.get('/roles', { signal })
      const list = Array.isArray(res.data) ? (res.data as AssignableRole[]) : []
      // super_admin is a platform role, never assignable from the tenant UI.
      return list.filter(r => r.name !== 'super_admin')
    },
  })
  return { roles: data ?? [], loading: isLoading }
}
