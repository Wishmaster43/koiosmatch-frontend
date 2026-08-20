/**
 * UsersPage — user & role management for the current tenant (Settings →
 * Beheer → Gebruikers). Thin container in the house settings shape: title +
 * subtitle, a search box and a real "+ Gebruiker" button above the shared table,
 * with the four UI states handled explicitly.
 *
 * It owns no business logic: the list/mutations live in `useUsersData`, the
 * soft-delete-with-ownership-transfer flow in `useUserDeletion`, and every visual
 * part in `UsersTable` / the dialogs. Rights only decide what is VISIBLE (§7) —
 * the backend re-checks users.create / users.update / users.delete /
 * users.assign_roles on every route.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import HeaderSearch from '@/components/ui/HeaderSearch'
import NewUserModal from './NewUserModal'
import EditUserModal from './EditUserModal'
import UserRolesModal from './UserRolesModal'
import UserTransferDeleteModal from './UserTransferDeleteModal'
import UsersTable from './UsersTable'
import { userDisplayName } from './userRow'
import type { UserRow } from './userRow'
import { useUsersData } from './hooks/useUsersData'
import { useUserDeletion } from './hooks/useUserDeletion'
import { roleName } from './usersParts'
import Button from '@/components/ui/Button'
import { PageTitle } from '@/components/ui/typography'

export default function UsersPage() {
  const { t } = useTranslation('users')
  const auth = useAuth()
  const me = auth?.user
  // Data layer (load + optimistic mutations) lives in the hook; the page wires it.
  const { users, roles, loading, error, setColor, addUser, updateUser, removeUser } = useUsersData()
  const [showCreate,   setShowCreate]   = useState(false)
  const [editingUser,  setEditingUser]  = useState<UserRow | null>(null)
  const [rolesUser,    setRolesUser]    = useState<UserRow | null>(null)
  const [query,        setQuery]        = useState('')
  const [selectedRole, setSelectedRole] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  // Two-step soft-delete: a 422 with `requires_transfer` opens the transfer dialog.
  const { target: deleteTarget, owned, busy: deleting, requestDelete, confirmTransfer, close: closeDelete } =
    useUserDeletion(removeUser)

  // UI gating only — mirrors the backend's permission middleware names.
  const can = auth?.hasPermission
  const canCreate      = can?.('users.create') ?? false
  const canUpdate      = can?.('users.update') ?? false
  const canDelete      = can?.('users.delete') ?? false
  const canAssignRoles = can?.('users.assign_roles') ?? false

  // ManagedUser already satisfies UserRow (its extra fields are optional).
  const rows: UserRow[] = users

  const roleOptions = useMemo(() =>
    [...new Set(rows.flatMap(u => (u.roles ?? []).map(roleName)))]
      .filter((r): r is string => Boolean(r))
      .map(r => ({ value: r, label: r, count: rows.filter(u => (u.roles ?? []).some(x => roleName(x) === r)).length }))
  , [rows])

  const filterGroups = useMemo(() => [
    { key: 'role', label: t('filterRole'), selected: selectedRole, options: roleOptions, onToggle: (v: string) => setSelectedRole(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedRole, roleOptions])

  useEffect(() => {
    registerFilters('users-page', filterGroups)
    return () => unregisterFilters('users-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  // Search is client-side on purpose: GET /users takes no query parameters
  // (measured 09-08 — UserController::index lists the tenant's users unfiltered),
  // and a tenant's user count is small enough that this stays honest and instant.
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return rows.filter(u => {
      const matchesRole = !selectedRole.length || selectedRole.some(r => (u.roles ?? []).some(x => roleName(x) === r))
      const matchesQuery = !q || `${userDisplayName(u)} ${u.email ?? ''}`.toLowerCase().includes(q)
      return matchesRole && matchesQuery
    })
  }, [rows, selectedRole, query])

  // Stable identities so UsersTable's memoized column array isn't rebuilt per keystroke.
  const handlePickColor = useCallback((u: UserRow, color: string | null) => setColor(u, color), [setColor])
  const handleEdit      = useCallback((u: UserRow) => setEditingUser(u), [])
  const handleEditRoles = useCallback((u: UserRow) => setRolesUser(u), [])
  const handleDelete    = useCallback((u: UserRow) => { void requestDelete(u) }, [requestDelete])

  // Successor candidates for a transfer: every other user still in the list.
  const successors = useMemo(
    () => (deleteTarget ? rows.filter(u => u.id !== deleteTarget.id) : []),
    [rows, deleteTarget],
  )

  return (
    <div>
      {/* Header — the settings-section shape (title + subtitle, actions right). */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <PageTitle>{t('title')}</PageTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {loading ? t('subtitle') : t('summary', { shown: filtered.length, total: rows.length })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeaderSearch onSearch={setQuery} placeholder={t('searchPlaceholder')} ariaLabel={t('searchPlaceholder')} width={220} />
          {/* Hidden without the right, never a dead button (§7 — backend re-checks). */}
          {canCreate && (
            <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
              <Plus size={14} aria-hidden="true" /> {t('newUser')}
            </Button>
          )}
        </div>
      </div>

      {/* Error is its own state; DataTable owns loading / empty / success. */}
      <div style={{ background: 'var(--surface)', borderRadius: 12,
                    border: '1px solid var(--border)', overflow: 'auto' }}>
        {!loading && error ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '40px 0', fontSize: 13, color: 'var(--color-danger)' }}>
            <AlertTriangle size={14} aria-hidden="true" /> {error}
          </div>
        ) : (
          <UsersTable rows={filtered} loading={loading} currentUserId={me?.id ?? null}
            canUpdate={canUpdate} canDelete={canDelete} canAssignRoles={canAssignRoles}
            onEdit={handleEdit} onEditRoles={handleEditRoles} onDelete={handleDelete} onPickColor={handlePickColor} />
        )}
      </div>

      {showCreate && (
        <NewUserModal onClose={() => setShowCreate(false)} onCreated={addUser} />
      )}
      {editingUser && (
        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)}
          onSaved={updated => { updateUser(updated); setEditingUser(null) }} />
      )}
      {rolesUser && (
        <UserRolesModal user={rolesUser} roles={roles} onClose={() => setRolesUser(null)}
          onSaved={updated => { updateUser(updated); setRolesUser(null) }} />
      )}
      {/* The ownership hand-off — the ONLY way a still-coupled user is removed. */}
      {deleteTarget && owned && (
        <UserTransferDeleteModal user={deleteTarget} owned={owned} successors={successors}
          busy={deleting} onConfirm={confirmTransfer} onClose={closeDelete} />
      )}
    </div>
  )
}
