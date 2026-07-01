/**
 * UsersPage — manage the users within the current tenant. Thin container: lists
 * users with search + role filter, and opens the create/edit dialogs. The role
 * badge/changer and the editable colour avatar live in `usersParts`.
 */
import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useRightPanel } from '../../context/RightPanelContext'
import NewUserModal from './NewUserModal'
import EditUserModal from './EditUserModal'
import { RoleBadge, RoleSelector, EditableAvatar, isSuperAdminUser, roleName } from './usersParts'
import type { AvailableRole } from './usersParts'
import type { ManagedUser } from '@/types/api'

const TH: CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
  whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const TD: CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #F9FAFB', verticalAlign: 'middle' }

export default function UsersPage() {
  const { t } = useTranslation('users')
  const { user: me } = useAuth() ?? {}
  const [users,        setUsers]        = useState<ManagedUser[]>([])
  const [roles,        setRoles]        = useState<AvailableRole[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editingUser,  setEditingUser]  = useState<ManagedUser | null>(null)
  const [selectedRole, setSelectedRole] = useState<string[]>([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/roles')])
      .then(([usersRes, rolesRes]) => {
        const list = usersRes.data?.data ?? usersRes.data ?? []
        setUsers(Array.isArray(list) ? list : [])
        const roleList = rolesRes.data ?? []
        setRoles(roleList.filter((r: AvailableRole) => r.name !== 'super_admin' && r.name !== 'tenant_admin'))
      })
      .catch(err => setError(err?.response?.status === 403 ? t('noAccess') : t('loadError')))
      .finally(() => setLoading(false))
  }, [])

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

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12,
                    border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TH}>{t('cols.name')}</th>
              <th style={TH}>{t('cols.email')}</th>
              <th style={TH}>{t('cols.phone')}</th>
              <th style={TH}>{t('cols.role')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                {t('loading')}
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--color-danger)', fontSize: 13 }}>
                {error}
              </td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                {t('empty')}
              </td></tr>
            )}
            {!loading && filtered.map((u, i) => {
              const name = [u.firstname, u.lastname].filter(Boolean).join(' ') || u.name || '—'
              const isMe = u.id === me?.id
              const isSA = isSuperAdminUser(u)
              return (
                <tr key={u.id ?? i}
                  style={{ transition: 'background 0.1s', background: isMe ? 'var(--color-primary-bg)' : isSA ? '#FAFBFF' : undefined }}
                  onMouseEnter={e => { if (!isMe && !isSA) e.currentTarget.style.background = '#FAFAFA' }}
                  onMouseLeave={e => { if (!isMe && !isSA) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ ...TD, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <EditableAvatar user={u} onPick={color => setColor(u, color)} />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {name}
                          {/* Edit button — not shown for super-admin accounts */}
                          {!isSA && (
                            <button onClick={() => setEditingUser(u)} title={t('editUser')} aria-label={t('editUser')}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                       width: 20, height: 20, borderRadius: 5, border: '1px solid #E5E7EB',
                                       background: 'white', cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>
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
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#7C3AED',
                                           background: '#F5F3FF', borderRadius: 999, padding: '1px 7px' }}>
                              {t('system')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...TD, minWidth: 200, color: 'var(--text-muted)', fontSize: 12 }}>{u.email ?? '—'}</td>
                  <td style={{ ...TD, minWidth: 140, color: 'var(--text-muted)', fontSize: 12 }}>{u.phone ?? '—'}</td>
                  <td style={TD}>
                    {isSA ? (
                      <RoleBadge role="super_admin" />
                    ) : (
                      <RoleSelector
                        user={u}
                        availableRoles={roles}
                        onChanged={updated => setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <NewUserModal
          onClose={() => setShowCreate(false)}
          onCreated={u => setUsers(prev => [u, ...prev])}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={updated => {
            setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}
