/**
 * RolesSettings — list of roles → click a role to open its permission detail
 * (RoleDetail: appearance + branch template + the HelloFlex-style rights list
 * in RolesPermissionMatrix). Thin container: owns the roles/permissions fetch
 * + create/delete, delegates the detail view entirely to RoleDetail.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { RoleDetail } from './RoleDetail'
import { roleIconEl, ROLE_ICON_NAMES } from '@/lib/roleIcons'
import { useConfirm } from '@/hooks/useConfirm'
import { BTN_H } from '@/config/buttonMetrics'
import type { Role, PermissionsByGroup, CreateRoleBody } from './rolesTypes'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { tintBg, tintBorder } from '@/lib/tint'

export default function RolesSettings() {
  const { t } = useTranslation('settings')
  const [roles,       setRoles]       = useState<Role[]>([])
  const [permissions, setPermissions] = useState<PermissionsByGroup>({})
  const [iconOptions, setIconOptions] = useState<string[]>(ROLE_ICON_NAMES)
  const [loading,     setLoading]     = useState(true)
  const [newRoleName, setNewRoleName] = useState('')
  const [creating,    setCreating]    = useState(false)
  const [deleting,    setDeleting]    = useState<Role['id'] | null>(null)
  const [editRole,    setEditRole]    = useState<Role | null>(null)
  const { confirm, dialog } = useConfirm()

  useEffect(() => {
    Promise.all([api.get<Role[]>('/roles'), api.get<PermissionsByGroup>('/permissions')])
      .then(([rolesRes, permsRes]) => { setRoles(rolesRes.data); setPermissions(permsRes.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
    // Allowed icon set (config/roles.php); fall back to the built-in list on 404.
    api.get('/roles/icons').then(r => {
      const list = unwrap<Array<string | { name?: string; value?: string }>>(r)
      if (Array.isArray(list) && list.length) {
        setIconOptions(list.map(x => (typeof x === 'string' ? x : x.name ?? x.value)).filter((x): x is string => Boolean(x)))
      }
    }).catch(() => {})
  }, [])

  const createRole = async () => {
    if (!newRoleName.trim()) return
    setCreating(true)
    try {
      const res = await api.post<Role>('/roles', { name: newRoleName.trim() } satisfies CreateRoleBody)
      setRoles(prev => [...prev, res.data]); setNewRoleName('')
    } catch { /* noop */ }
    setCreating(false)
  }

  const deleteRole = (role: Role) => {
    confirm(t('roles.confirmDelete', { name: role.name }), async () => {
      setDeleting(role.id)
      try {
        await api.delete(`/roles/${role.id}`)
        setRoles(prev => prev.filter(r => r.id !== role.id))
        if (editRole?.id === role.id) setEditRole(null)
      } catch { /* noop */ }
      setDeleting(null)
    }, { danger: true })
  }

  const handleUpdate = (updated: Role) => {
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
    setEditRole(updated)
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 200 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('roles.loading')}</p>
    </div>
  )

  const visibleRoles = roles.filter(r => r.name !== 'super_admin' && r.name !== 'tenant_admin')

  if (editRole) {
    return <RoleDetail role={editRole} permissions={permissions} iconOptions={iconOptions}
      onBack={() => setEditRole(null)} onUpdate={handleUpdate} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{t('roles.title')}</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t('roles.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)}
            placeholder={t('roles.newPlaceholder')} onKeyDown={e => e.key === 'Enter' && createRole()}
            style={{ height: 34, padding: '0 10px', fontSize: 13, border: '1px solid var(--border)',
                     borderRadius: 8, outline: 'none', color: 'var(--text)', width: 150 }} />
          {/* Paired with the name input above — a soft CTA, not the row-level "+ add"
              affordance, so it stays a Button (soft, not solid primary) rather than DrawerAddButton. */}
          <Button variant="primary" onClick={createRole} disabled={creating || !newRoleName.trim()}>
            <Plus size={13} /> {t('roles.create')}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleRoles.map(role => {
          const permCount = role.permissions?.length ?? 0
          const userCount = role.users_count ?? 0
          const canDelete = userCount === 0
          // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a role without one stored yet, not UI chrome
          const color = role.color || '#6B7280'
          return (
            <div key={role.id}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                       background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              {/* Icon swatch — a non-chip tinted surface, so the house tintBg/tintBorder
                  formula applies here rather than SoftChip (§4, HUISSTIJL-1). */}
              <div style={{ width: 36, height: 36, borderRadius: 10, background: tintBg(color), border: tintBorder(color),
                             display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {roleIconEl(role.icon, { size: 16, color })}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{role.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('roles.rightsCount', { count: permCount })} · {t('roles.usersCount', { count: userCount })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
                <button onClick={() => setEditRole(role)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 14px',
                           fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                           border: '1px solid var(--color-primary)', background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)' }}>
                  {t('roles.edit')}
                </button>
                <button onClick={() => canDelete && deleteRole(role)} disabled={!canDelete || deleting === role.id}
                  title={canDelete ? t('roles.deleteTitle') : t('roles.deleteBlocked', { count: userCount })}
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', borderRadius: 8, cursor: canDelete ? 'pointer' : 'not-allowed',
                    background: canDelete ? 'var(--color-danger-bg)' : 'var(--hover-bg)',
                    color: canDelete ? 'var(--color-danger)' : 'var(--border)' }}>
                  {deleting === role.id ? <Spinner size={12} /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          )
        })}
        {visibleRoles.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>{t('roles.empty')}</p>
        )}
      </div>
      {dialog}
    </div>
  )
}
