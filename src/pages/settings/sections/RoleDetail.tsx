/**
 * RoleDetail — a role's detail view: name + appearance (colour/icon/start
 * dashboard) header, the branch template, and the HelloFlex-style rights list
 * (RolesPermissionMatrix). Thin container: wires data + renders the header
 * config, no business logic beyond its own save handlers.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { ColorSwatch } from '../components/SettingsControls'
import { PermissionMatrix } from './RolesPermissionMatrix'
import type { PermissionGroups } from './RolesPermissionMatrix'
import { RoleBranchTemplate } from './RoleBranchTemplate'
import { roleIconEl } from '@/lib/roleIcons'
import RoleChip from '@/components/ui/RoleChip'
import Spinner from '@/components/ui/Spinner'
import SearchSelect from '@/components/ui/SearchSelect'
import { DASHBOARD_TYPES } from '@/pages/dashboard/templates'
import { BTN_H } from '@/config/buttonMetrics'
import type { Role, PermissionsByGroup, UpdateRoleBody, UpdatePermissionsBody } from './rolesTypes'
import Button from '@/components/ui/Button'
import { tintBg } from '@/lib/tint'

interface IconPickerProps {
  value: string
  color: string
  options: string[]
  onPick: (name: string) => void
}

// Small popover grid to pick a role icon from the allowed set.
function IconPicker({ value, color, options, onPick }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Button variant="secondary" onClick={() => setOpen(o => !o)}
        style={{ width: 34 }}>
        {roleIconEl(value, { size: 17, color })}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="z-50" style={{ position: 'absolute', top: '110%', left: 0, marginTop: 4,
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, padding: 8, width: 300,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.16)' }}>
            {options.map(name => {
              const active = name === value
              return (
                <button key={name} onClick={() => { onPick(name); setOpen(false) }} title={name}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
                    borderRadius: 7, cursor: 'pointer', border: `1px solid ${active ? color || 'var(--color-primary)' : 'transparent'}`,
                    // Non-chip tinted surface: the house tintBg formula, not hex-concat (§4, HUISSTIJL-1).
                    background: active ? tintBg(color || 'var(--color-primary)') : 'var(--hover-bg)' }}>
                  {roleIconEl(name, { size: 15, color: active ? color : 'var(--text)' })}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

interface RoleDetailProps {
  role: Role
  permissions: PermissionsByGroup
  iconOptions: string[]
  onBack: () => void
  onUpdate: (role: Role) => void
}

export function RoleDetail({ role, permissions, iconOptions, onBack, onUpdate }: RoleDetailProps) {
  const { t } = useTranslation('settings')
  // Dashboard-namespace translator so the "start dashboard" options use the same labels as the switcher.
  const { t: td } = useTranslation('dashboard')
  const [localRole, setLocalRole]   = useState<Role>(role)
  const [editName,  setEditName]    = useState(false)
  const [draftName, setDraftName]   = useState(role.name)
  const [saving,    setSaving]      = useState(false)

  // eslint-disable-next-line no-restricted-syntax -- DATA: fallback swatch colour for a role without one stored yet, not UI chrome
  const color    = localRole.color || '#6B7280'
  const iconName = localRole.icon || 'shield'

  const hasPermission = (perm: string) => localRole.permissions?.some(p => p.name === perm) ?? false

  const togglePermission = async (permName: string) => {
    const current = localRole.permissions?.map(p => p.name) ?? []
    const updated = current.includes(permName) ? current.filter(p => p !== permName) : [...current, permName]
    setSaving(true)
    try {
      const res = await api.put<Role>(`/roles/${localRole.id}/permissions`, { permissions: updated } satisfies UpdatePermissionsBody)
      setLocalRole(res.data); onUpdate(res.data)
    } catch { /* noop */ }
    setSaving(false)
  }

  const saveName = async () => {
    const name = draftName.trim()
    if (!name || name === localRole.name) { setEditName(false); return }
    setSaving(true)
    try {
      const res = await api.put<Role>(`/roles/${localRole.id}`, { name } satisfies UpdateRoleBody)
      const r = { ...localRole, name: res.data?.name ?? name }
      setLocalRole(r); onUpdate(r)
    } catch { /* noop */ }
    setSaving(false); setEditName(false)
  }

  // Appearance (colour + icon) + start dashboard persist optimistically via PUT /roles/{id}.
  const saveAppearance = async (patch: Partial<UpdateRoleBody>) => {
    const previous = localRole
    const next = { color, icon: iconName, dashboard_type: localRole.dashboard_type ?? null, ...patch }
    const r: Role = { ...localRole, color: next.color, icon: next.icon, dashboard_type: next.dashboard_type }
    setLocalRole(r); onUpdate(r)
    setSaving(true)
    try {
      await api.put(`/roles/${localRole.id}`, { color: next.color, icon: next.icon, dashboard_type: next.dashboard_type } satisfies UpdateRoleBody)
    } catch {
      // Revert both the local card and the parent list row — otherwise the picker
      // shows a colour/icon/dashboard the backend never actually saved (§3).
      setLocalRole(previous); onUpdate(previous)
      notifyError(t('roles.appearanceSaveFailed'))
    }
    setSaving(false)
  }

  // Filter out the `module` group (managed in the Modules tab) and the retired
  // `sync` group — the daily 05:00 cron replaced manual sync for tenant roles
  // (Danny 2026-07-20 "kan weg"); BE removal of sync.refresh tracked as SYNC-RETIRE-1.
  const groups: PermissionGroups = Object.entries(permissions).filter(([g]) => g !== 'module' && g !== 'sync')

  return (
    <div>
      {/* Back + role name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        {/* BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
        <button onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: BTN_H, padding: '0 12px',
                   fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--hover-bg)',
                   color: 'var(--text)', cursor: 'pointer' }}>
          <ArrowLeft size={13} /> {t('common.back')}
        </button>
        {roleIconEl(iconName, { size: 16, style: { color } })}
        {editName ? (
          <input autoFocus value={draftName}
            onChange={e => setDraftName(e.target.value)} onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setDraftName(localRole.name); setEditName(false) } }}
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', border: '1px solid var(--color-primary)',
                     borderRadius: 8, padding: '4px 10px', outline: 'none' }} />
        ) : (
          <h2 onClick={() => setEditName(true)} title={t('roles.editNameTitle')}
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', cursor: 'text', margin: 0 }}>
            {localRole.name}
          </h2>
        )}
        {saving && <span style={{ color: 'var(--text-muted)' }}><Spinner size={13} /></span>}
      </div>

      {/* Appearance — colour + icon picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22, padding: '12px 16px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('roles.color')}</span>
          <ColorSwatch color={color} onChange={(c: string) => saveAppearance({ color: c })} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('roles.icon')}</span>
          <IconPicker value={iconName} color={color} options={iconOptions} onPick={name => saveAppearance({ icon: name })} />
        </div>
        {/* Start dashboard — couples this role to a dashboard type (same labels as the switcher). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('roles.startDashboard')}</span>
          <SearchSelect
            options={[{ value: '', label: t('roles.startDashboardNone') }, ...DASHBOARD_TYPES.map(dt => ({ value: dt, label: td(`types.${dt}`) }))]}
            selected={[localRole.dashboard_type ?? '']}
            onToggle={v => saveAppearance({ dashboard_type: v || null })}
            closeOnToggle
            renderTrigger={toggle => (
              <button type="button" onClick={toggle} aria-label={t('roles.startDashboard')}
                style={{ height: 30, padding: '0 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 7,
                         background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                {localRole.dashboard_type ? td(`types.${localRole.dashboard_type}`) : t('roles.startDashboardNone')}
              </button>
            )}
          />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <RoleChip name={localRole.name} color={color} icon={iconName} />
        </div>
      </div>

      {/* Branch template — the starting set new users with this role inherit (§ USERS-ROLES-LOC-1) */}
      <RoleBranchTemplate roleId={localRole.id} />

      {/* Rights list — HelloFlex-style expandable rows, one per permission group */}
      <PermissionMatrix groups={groups} hasPermission={hasPermission} onToggle={togglePermission} />
    </div>
  )
}
