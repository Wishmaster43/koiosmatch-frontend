/**
 * UsersPage — manage the users within the current tenant. Thin container: lists
 * users with search + role filter, and opens the create/edit dialogs. The role
 * badge/changer and the editable colour avatar live in `usersParts`.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRightPanel } from '@/context/RightPanelContext'
import DataTable from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import NewUserModal from './NewUserModal'
import EditUserModal from './EditUserModal'
import { useUsersData } from './hooks/useUsersData'
import { RoleBadge, RoleSelector, EditableAvatar, isSuperAdminUser, roleName, SUPER_ADMIN_COLOR } from './usersParts'
import type { ManagedUser } from '@/types/api'

// Display name: "first last", falling back to the combined name field.
const nameOf = (u: ManagedUser) => [u.firstname, u.lastname].filter(Boolean).join(' ') || u.name || '—'

export default function UsersPage() {
  const { t } = useTranslation('users')
  const { user: me } = useAuth() ?? {}
  // Data layer (load + optimistic mutations) lives in the hook; the page stays presentational.
  const { users, roles, loading, error, setColor, addUser, updateUser } = useUsersData()
  const [showCreate,   setShowCreate]   = useState(false)
  const [editingUser,  setEditingUser]  = useState<ManagedUser | null>(null)
  const [selectedRole, setSelectedRole] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  const roleOptions = useMemo(() =>
    [...new Set(users.flatMap(u => (u.roles ?? []).map(roleName)))]
      .filter((r): r is string => Boolean(r))
      .map(r => ({ value: r, label: r, count: users.filter(u => (u.roles ?? []).some(x => roleName(x) === r)).length }))
  , [users])

  const filterGroups = useMemo(() => [
    { key: 'role', label: t('filterRole'), selected: selectedRole, options: roleOptions, onToggle: (v: string) => setSelectedRole(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedRole, roleOptions])

  useEffect(() => {
    registerFilters('users-page', filterGroups)
    return () => unregisterFilters('users-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    if (!selectedRole.length) return users
    return users.filter(u => selectedRole.some(r => (u.roles ?? []).some(x => roleName(x) === r)))
  }, [users, selectedRole])

  // Column declarations for the shared DataTable — the table owns layout/hover/states.
  const columns: Column<ManagedUser>[] = [
    // Name — colour-pick avatar, name, edit pencil (not on system accounts) + you/system badges.
    { key: 'name', header: t('cols.name'), width: 200, render: u => {
      const isMe = u.id != null && u.id === me?.id
      const isSA = isSuperAdminUser(u)
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EditableAvatar user={u} onPick={color => setColor(u, color)} />
          <div style={{ fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {nameOf(u)}
            {/* Edit button — not shown for super-admin accounts */}
            {!isSA && (
              <button onClick={() => setEditingUser(u)} title={t('editUser')} aria-label={t('editUser')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                         width: 20, height: 20, borderRadius: 5, border: '1px solid var(--border)',
                         background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                <Pencil size={10} />
              </button>
            )}
            {isMe && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary)',
                             background: 'var(--color-primary-bg)', borderRadius: 999, padding: '1px 7px' }}>
                {t('you')}
              </span>
            )}
            {isSA && (
              <span style={{ fontSize: 10, fontWeight: 600, color: SUPER_ADMIN_COLOR,
                             background: `color-mix(in srgb, ${SUPER_ADMIN_COLOR} 10%, transparent)`,
                             borderRadius: 999, padding: '1px 7px' }}>
                {t('system')}
              </span>
            )}
          </div>
        </div>
      )
    } },
    // Email / phone — muted secondary text.
    { key: 'email', header: t('cols.email'), width: 200, cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: u => u.email ?? '—' },
    { key: 'phone', header: t('cols.phone'), width: 140, cellStyle: { color: 'var(--text-muted)', fontSize: 12 },
      render: u => u.phone ?? '—' },
    // Role — read-only badge for system accounts, inline role-changer otherwise.
    { key: 'role', header: t('cols.role'), render: u => isSuperAdminUser(u)
      ? <RoleBadge role="super_admin" />
      : <RoleSelector user={u} availableRoles={roles} onChanged={updateUser} /> },
  ]

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            {t('title')}
          </h2>
          {!loading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {t('summary', { shown: filtered.length, total: users.length })}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                     fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                     background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> {t('newUser')}
          </button>
        </div>
      </div>

      {/* Table card — error renders its own state; DataTable owns loading/empty/success. */}
      <div style={{ background: 'var(--surface)', borderRadius: 12,
                    border: '1px solid var(--border)', overflow: 'auto' }}>
        {!loading && error ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-danger)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={u => u.id ?? u.email ?? ''}
            loading={loading}
            loadingText={t('loading')}
            emptyText={t('empty')}
            selectedId={me?.id ?? null}
          />
        )}
      </div>

      {showCreate && (
        <NewUserModal
          onClose={() => setShowCreate(false)}
          onCreated={addUser}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={updated => { updateUser(updated); setEditingUser(null) }}
        />
      )}
    </div>
  )
}
