/**
 * useUsersData — the data layer for UsersPage (§3): loads the tenant users +
 * assignable roles, owns the users list, and holds the optimistic mutations
 * (colour pick, plus list add/replace for the create/edit dialogs). The page
 * stays presentational (search/filter + dialog wiring only).
 * A 403 becomes a "no access" message; any other failure a generic load error.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrapList } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import type { AvailableRole } from '../usersParts'
import type { ManagedUser } from '@/types/api'

// Data layer for the users page: loads users/roles, owns the list, and applies the optimistic mutations, so the page itself stays presentational (see file header).
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

  // Optimistically set a user's icon colour (PUT /users/{id}); revert on failure.
  // PUT, not PATCH: the generated contract (operations.putUsersUserId) documents
  const setColor = async (u: ManagedUser, color: string | null) => {
    const prev = u.avatar_color ?? null
    setUsers(list => list.map(x => x.id === u.id ? { ...x, avatar_color: color } : x))
    try {
      await api.put(`/users/${u.id}`, { avatar_color: color })
    } catch {
      // Revert AND say so — the sibling useUserBranches.toggle already does both;
      // this one used to revert silently, leaving no clue the pick didn't stick (§3).
      setUsers(list => list.map(x => x.id === u.id ? { ...x, avatar_color: prev } : x))
      notifyError(t('saveFailed'))
    }
  }

  // List helpers for the create/edit dialogs (server call lives in the modals).
  const addUser    = (u: ManagedUser) => setUsers(prev => [u, ...prev])
  const updateUser = (u: ManagedUser) => setUsers(prev => prev.map(x => x.id === u.id ? u : x))
  // Drop a soft-deleted user from the list. Stable identity: it is handed to
  // useUserDeletion, which the page memoizes its row callbacks against.
  const removeUser = useCallback((id: string) => setUsers(prev => prev.filter(x => String(x.id) !== id)), [])

  return { users, roles, loading, error, setColor, addUser, updateUser, removeUser }
}
