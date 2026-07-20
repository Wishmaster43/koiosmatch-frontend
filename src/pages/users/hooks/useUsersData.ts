/**
 * useUsersData — the data layer for UsersPage (§3): loads the tenant users +
 * assignable roles, owns the users list, and holds the optimistic mutations
 * (colour pick, plus list add/replace for the create/edit dialogs). The page
 * stays presentational (search/filter + dialog wiring only).
 * A 403 becomes a "no access" message; any other failure a generic load error.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import type { AvailableRole } from '../usersParts'
import type { ManagedUser } from '@/types/api'

export function useUsersData() {
  const { t } = useTranslation('users')
  const [users,   setUsers]   = useState<ManagedUser[]>([])
  const [roles,   setRoles]   = useState<AvailableRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  // Load users + roles once; super_admin/tenant_admin are not user-assignable here.
  // Branch links arrive ON the list rows (USERS-BRANCHES-LIST-1) — no per-user calls.
  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/roles')])
      .then(([usersRes, rolesRes]) => {
        const list = unwrapList<ManagedUser>(usersRes).rows
        const rows = Array.isArray(list) ? list : []
        setUsers(rows)
        const roleList = rolesRes.data ?? []
        setRoles(roleList.filter((r: AvailableRole) => r.name !== 'super_admin' && r.name !== 'tenant_admin'))
      })
      .catch(err => setError(err?.response?.status === 403 ? t('noAccess') : t('loadError')))
      .finally(() => setLoading(false))
  }, [])

  // Optimistically set a user's icon colour (PATCH /users/{id}); revert on failure.
  const setColor = async (u: ManagedUser, color: string | null) => {
    const prev = u.avatar_color ?? null
    setUsers(list => list.map(x => x.id === u.id ? { ...x, avatar_color: color } : x))
    try {
      await api.patch(`/users/${u.id}`, { avatar_color: color })
    } catch {
      setUsers(list => list.map(x => x.id === u.id ? { ...x, avatar_color: prev } : x))
    }
  }

  // List helpers for the create/edit dialogs (server call lives in the modals).
  const addUser    = (u: ManagedUser) => setUsers(prev => [u, ...prev])
  const updateUser = (u: ManagedUser) => setUsers(prev => prev.map(x => x.id === u.id ? u : x))

  return { users, roles, loading, error, setColor, addUser, updateUser }
}
