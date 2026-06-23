/**
 * RolesSettings — list of roles → click a role to open its permission detail.
 * Detail shows collapsible permission groups with a toggle per permission.
 * The `module` group is hidden — module access is managed in the Modules tab.
 * Group/action/permission labels are translated via t('roles.*').
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, ChevronRight, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react'
import api from '../../../lib/api'
import { PermissionToggle } from '../components/SettingsControls'

function RoleDetail({ role, permissions, onBack, onUpdate }) {
  const { t } = useTranslation('settings')
  const [localRole, setLocalRole]   = useState(role)
  const [editName,  setEditName]    = useState(false)
  const [draftName, setDraftName]   = useState(role.name)
  const [saving,    setSaving]      = useState(false)
  const [collapsed, setCollapsed]   = useState({})

  const hasPermission = (perm) => localRole.permissions?.some(p => p.name === perm)
  const groupLabel  = (g) => t(`roles.groups.${g}`, { defaultValue: g })
  const actionLabel = (a) => t(`roles.actions.${a}`, { defaultValue: a })

  const togglePermission = async (permName) => {
    const current = localRole.permissions?.map(p => p.name) ?? []
    const updated = current.includes(permName)
      ? current.filter(p => p !== permName)
      : [...current, permName]
    setSaving(true)
    try {
      const res = await api.put(`/roles/${localRole.id}/permissions`, { permissions: updated })
      const updated_role = res.data
      setLocalRole(updated_role)
      onUpdate(updated_role)
    } catch { /* noop */ }
    setSaving(false)
  }

  const saveName = async () => {
    const name = draftName.trim()
    if (!name || name === localRole.name) { setEditName(false); return }
    setSaving(true)
    try {
      const res = await api.put(`/roles/${localRole.id}`, { name })
      const updated_role = { ...localRole, name: res.data?.name ?? name }
      setLocalRole(updated_role)
      onUpdate(updated_role)
    } catch { /* noop */ }
    setSaving(false)
    setEditName(false)
  }

  // Filter out the `module` group — managed separately in the Modules tab.
  const groups = Object.entries(permissions).filter(([g]) => g !== 'module')

  return (
    <div>
      {/* Back + role name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
                   fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)',
                   color: 'var(--text)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> {t('common.back')}
        </button>
        <Shield size={14} style={{ color: 'var(--color-primary)' }} />
        {editName ? (
          <input autoFocus value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setDraftName(localRole.name); setEditName(false) } }}
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', border: '1px solid var(--color-primary)',
                     borderRadius: 8, padding: '4px 10px', outline: 'none' }} />
        ) : (
          <h2 onClick={() => setEditName(true)} title={t('roles.editNameTitle')}
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', cursor: 'text', margin: 0 }}>
            {localRole.name}
          </h2>
        )}
        {saving && <RefreshCw size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
      </div>

      {/* Permission groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map(([group, perms]) => {
          const isOpen = !collapsed[group]
          return (
            <div key={group} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Group header — click to collapse */}
              <button onClick={() => setCollapsed(c => ({ ...c, [group]: !c[group] }))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                         background: 'var(--hover-bg)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                {isOpen ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
                  {groupLabel(group)}
                </span>
                <span style={{ fontSize: 11, color: '#C4C4CF', marginLeft: 'auto' }}>
                  {t('roles.rightsCount', { count: perms.length })}
                </span>
              </button>
              {/* Permissions inside the group */}
              {isOpen && (
                <div>
                  {perms.map((perm, i) => {
                    const action  = perm.name.split('.')[1] ?? perm.name
                    const checked = hasPermission(perm.name)
                    return (
                      <div key={perm.name}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                 padding: '10px 16px', background: i % 2 ? '#FCFCFD' : 'var(--surface)',
                                 borderTop: '1px solid var(--hover-bg)' }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: checked ? 500 : 400 }}>
                            {actionLabel(action)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{perm.name}</div>
                        </div>
                        <PermissionToggle checked={checked} onChange={() => togglePermission(perm.name)} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RolesSettings() {
  const { t } = useTranslation('settings')
  const [roles,       setRoles]       = useState([])
  const [permissions, setPermissions] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [newRoleName, setNewRoleName] = useState('')
  const [creating,    setCreating]    = useState(false)
  const [deleting,    setDeleting]    = useState(null)
  const [editRole,    setEditRole]    = useState(null)   // the role currently open in detail view

  useEffect(() => {
    Promise.all([api.get('/roles'), api.get('/permissions')])
      .then(([rolesRes, permsRes]) => {
        setRoles(rolesRes.data)
        setPermissions(permsRes.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const createRole = async () => {
    if (!newRoleName.trim()) return
    setCreating(true)
    try {
      const res = await api.post('/roles', { name: newRoleName.trim() })
      setRoles(prev => [...prev, res.data])
      setNewRoleName('')
    } catch { /* noop */ }
    setCreating(false)
  }

  const deleteRole = async (role) => {
    if (!confirm(t('roles.confirmDelete', { name: role.name }))) return
    setDeleting(role.id)
    try {
      await api.delete(`/roles/${role.id}`)
      setRoles(prev => prev.filter(r => r.id !== role.id))
      if (editRole?.id === role.id) setEditRole(null)
    } catch { /* noop */ }
    setDeleting(null)
  }

  const handleUpdate = (updated) => {
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRole(updated)
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 200 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('roles.loading')}</p>
    </div>
  )

  // System roles hidden entirely — not editable via the UI
  const visibleRoles = roles.filter(r => r.name !== 'super_admin' && r.name !== 'tenant_admin')

  // Detail view for a specific role
  if (editRole) {
    return (
      <RoleDetail
        role={editRole}
        permissions={permissions}
        onBack={() => setEditRole(null)}
        onUpdate={handleUpdate}
      />
    )
  }

  // List view — all visible roles as cards
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('roles.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('roles.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
            placeholder={t('roles.newPlaceholder')}
            onKeyDown={e => e.key === 'Enter' && createRole()}
            style={{ height: 34, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)',
                     borderRadius: 8, outline: 'none', color: 'var(--text)', width: 150 }} />
          <button onClick={createRole} disabled={creating || !newRoleName.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px',
                     fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer', border: 'none',
                     background: 'var(--color-primary)', color: 'white', opacity: newRoleName.trim() ? 1 : 0.4 }}>
            <Plus size={13} /> {t('roles.create')}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleRoles.map(role => {
          const permCount   = role.permissions?.length ?? 0
          const userCount   = role.users_count ?? 0
          const canDelete   = userCount === 0
          return (
            <div key={role.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                       background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-bg)',
                             display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={16} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{role.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('roles.rightsCount', { count: permCount })} · {t('roles.usersCount', { count: userCount })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => setEditRole(role)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
                           fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                           border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)',
                           color: 'var(--color-primary)' }}>
                  {t('roles.edit')}
                </button>
                <button
                  onClick={() => canDelete && deleteRole(role)}
                  disabled={!canDelete || deleting === role.id}
                  title={canDelete ? t('roles.deleteTitle') : t('roles.deleteBlocked', { count: userCount })}
                  style={{
                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', borderRadius: 8,
                    cursor: canDelete ? 'pointer' : 'not-allowed',
                    background: canDelete ? 'var(--color-danger-bg)' : 'var(--hover-bg)',
                    color: canDelete ? 'var(--color-danger)' : 'var(--border)',
                  }}
                  onMouseEnter={e => { if (canDelete) e.currentTarget.style.background = 'var(--color-danger-bg)' }}
                  onMouseLeave={e => { if (canDelete) e.currentTarget.style.background = 'var(--color-danger-bg)' }}>
                  {deleting === role.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          )
        })}
        {visibleRoles.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>{t('roles.empty')}</p>
        )}
      </div>
    </div>
  )
}
