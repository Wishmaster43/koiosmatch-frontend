/**
 * RoleDetail — a role's detail view: name + appearance (colour/icon/start
 * dashboard) header, the branch template, and the HelloFlex-style rights list
 * (RolesPermissionMatrix). Thin container: wires data + renders the header
 * config, no business logic beyond its own save handlers.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check, Save } from 'lucide-react'
import api from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useConfirm } from '@/hooks/useConfirm'
import { useSettingsDirty } from '../lib/useSettingsDirty'
import { ColorSwatch } from '../components/SettingsControls'
import { PermissionMatrix } from './RolesPermissionMatrix'
import type { PermissionGroups } from './RolesPermissionMatrix'
import { RoleBranchTemplate } from './RoleBranchTemplate'
import { roleIconEl } from '@/lib/roleIcons'
import RoleChip from '@/components/ui/RoleChip'
import Spinner from '@/components/ui/Spinner'
import SaveButton from '@/components/ui/SaveButton'
import SearchSelect from '@/components/ui/SearchSelect'
import { DASHBOARD_TYPES } from '@/pages/dashboard/shared'
import type { Role, PermissionsByGroup, UpdateRoleBody, UpdatePermissionsBody } from './rolesTypes'
import Button from '@/components/ui/Button'
import { tintBg } from '@/lib/tint'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

// True when two permission-name sets differ (used for the dirty check driving
// the Save button + the SettingsDirtyContext report).
function permSetsDiffer(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return true
  for (const name of a) if (!b.has(name)) return true
  return false
}

interface IconPickerProps {
  value: string
  color: string
  options: string[]
  onPick: (name: string) => void
}

// Small popover grid to pick a role icon from the allowed set.
function IconPicker({ value, color, options, onPick }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  // Defensive fallback so a caller without a resolved colour never tints with
  // `undefined` — today's only caller always passes one. Its own binding (not
  // inline in the style object below) so the HUISSTIJL accent-fill selector
  // doesn't mistake this tintBg() ARGUMENT for a hand-painted solid fill.
  const swatchColor = color || 'var(--color-primary)'
  // Single-source popover behaviour (Escape, stopped before it can bubble to a
  // host modal) via the shared useFocusTrap — arms only while `open`, since the
  // trap disarms itself when the ref detaches (see the hook's arming semantics).
  const trapRef = useFocusTrap<HTMLDivElement>(() => setOpen(false))
  return (
    <div style={{ position: 'relative' }}>
      <Button variant="secondary" onClick={() => setOpen(o => !o)}
        style={{ width: 34 }}>
        {roleIconEl(value, { size: 17, color })}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div ref={trapRef} tabIndex={-1} className="z-50" style={{ position: 'absolute', top: '110%', left: 0, marginTop: 4,
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, padding: 8, width: 300,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: 'var(--shadow-float)' }}>
            {options.map(name => {
              const active = name === value
              return (
                // Icon-grid CELL, not a standalone action — mirrors the accepted
                // calendar-grid-cell exemption (§4): a 32px swatch tile has no
                // Button-sized equivalent. Block form: style spans several lines.
                /* eslint-disable huisstijlLegacy/no-restricted-syntax */
                <button key={name} onClick={() => { onPick(name); setOpen(false) }} title={name}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
                    borderRadius: 7, cursor: 'pointer', border: `1px solid ${active ? swatchColor : 'transparent'}`,
                    // Non-chip tinted surface: the house tintBg formula, not hex-concat (§4, HUISSTIJL-1).
                    background: active ? tintBg(swatchColor) : 'var(--hover-bg)' }}>
                  {roleIconEl(name, { size: 15, color: active ? color : 'var(--text)' })}
                </button>
                /* eslint-enable huisstijlLegacy/no-restricted-syntax */
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

// Renders one role's permission matrix + appearance/name editing. Appearance and
// name persist immediately via their own PUT; permissions are a draft — toggles
// only flip local state, and Save sends the whole set in one PUT. Every persisted
// change bubbles up through onUpdate.
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

  // Permissions are a DRAFT (Danny 09-09: a toggle must react instantly, no
  // round trip per click) — savedPermissions is the last-persisted set, seeded
  // once from the role prop; draftPermissions is what the toggles/select-all
  // flip locally until Save sends the whole set in ONE PUT.
  const [savedPermissions, setSavedPermissions] = useState<Set<string>>(() => new Set(role.permissions?.map(p => p.name) ?? []))
  const [draftPermissions, setDraftPermissions] = useState<Set<string>>(() => new Set(role.permissions?.map(p => p.name) ?? []))
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [permissionsSaved,  setPermissionsSaved]  = useState(false)
  // Holds the "saved" flash timer so it can be cleared on unmount (§9 alive-guard
  // discipline) instead of firing setState after the section is gone.
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current) }, [])
  const permissionsDirty = permSetsDiffer(draftPermissions, savedPermissions)

  const hasPermission = (perm: string) => draftPermissions.has(perm)

  // User toggled one permission checkbox: flips the DRAFT only, no request —
  // Save persists the whole set at once.
  const togglePermission = (permName: string) => {
    setDraftPermissions(prev => {
      const next = new Set(prev)
      if (next.has(permName)) next.delete(permName); else next.add(permName)
      return next
    })
  }

  // Group/global select-all: flips every named permission to `on` in the draft
  // as ONE state update (never N stale-closure toggles, RolesPermissionMatrix).
  const setManyPermissions = (names: string[], on: boolean) => {
    setDraftPermissions(prev => {
      const next = new Set(prev)
      for (const name of names) { if (on) next.add(name); else next.delete(name) }
      return next
    })
  }

  // Save button: sends the draft set in ONE PUT and adopts the server's own row
  // (including its permissions) as the new saved baseline.
  const savePermissions = async () => {
    setSavingPermissions(true)
    try {
      const res = await api.put<Role>(`/roles/${localRole.id}/permissions`, { permissions: [...draftPermissions] } satisfies UpdatePermissionsBody)
      const saved = new Set(res.data.permissions?.map(p => p.name) ?? draftPermissions)
      setLocalRole(res.data); onUpdate(res.data)
      setSavedPermissions(saved); setDraftPermissions(saved)
      setPermissionsSaved(true)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setPermissionsSaved(false), 2000)
    } catch {
      notifyError(t('roles.permissionsSaveFailed'))
    }
    setSavingPermissions(false)
  }

  // Commits the in-place name edit; a blank or unchanged name just closes the editor.
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

  // Escape layer: cancels the in-place name edit, reverting the draft (one-stage).
  useEscapeLayer(editName, () => { setDraftName(localRole.name); setEditName(false) })

  // Reports the permissions draft's dirtiness up to the settings shell (same
  // contract SettingsScaffold uses) so navigating away with unsaved toggles warns.
  const dirtyCtx = useSettingsDirty()
  useEffect(() => {
    dirtyCtx?.report(permissionsDirty)
    return () => dirtyCtx?.report(false)
  }, [permissionsDirty, dirtyCtx])

  // Back button: an unsaved draft asks for confirmation first (in-page guard,
  // mirroring the shell's own tab-switch guard) instead of silently discarding it.
  const { confirm, dialog } = useConfirm()
  const handleBack = () => {
    if (permissionsDirty) confirm(t('common.unsavedConfirm'), onBack)
    else onBack()
  }

  return (
    <div>
      {/* Back + role name + permissions Save header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        {/* The previous raw 34px button was drift, and so was carrying its size
            into the migration (r5 finding 2): settings buttons ride the sm standard. */}
        <Button variant="secondary" onClick={handleBack}>
          <ArrowLeft size={13} /> {t('common.back')}
        </Button>
        {roleIconEl(iconName, { size: 16, style: { color } })}
        {editName ? (
          <input autoFocus value={draftName}
            onChange={e => setDraftName(e.target.value)} onBlur={saveName}
            onKeyDown={e => { if (e.key === 'Enter') saveName() }}
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', border: '1px solid var(--color-primary)',
                     borderRadius: 8, padding: '4px 10px', outline: 'none' }} />
        ) : (
          <h2 onClick={() => setEditName(true)} title={t('roles.editNameTitle')}
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', cursor: 'text', margin: 0 }}>
            {localRole.name}
          </h2>
        )}
        {saving && <span style={{ color: 'var(--text-muted)' }}><Spinner size={13} /></span>}
        {/* The ONE draft-permissions Save action — disabled while clean, ONE PUT
            of the whole draft set on click (Danny 09-09: "of fixen of een opslaan knop"). */}
        <div style={{ marginLeft: 'auto' }}>
          <SaveButton saved={permissionsSaved} disabled={!permissionsDirty || savingPermissions} onClick={savePermissions}>
            {permissionsSaved  ? <><Check size={13} /> {t('common.saved')}</>                                :
             savingPermissions ? <><Spinner size={13} /> {t('common.saving')}</> :
                                  <><Save size={13} /> {t('common.save')}</>}
          </SaveButton>
        </div>
      </div>
      {dialog}

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
          {/* Herhaal-audit r4 finding 6: SearchSelect's own default trigger face —
              triggerAriaLabel keeps the accessible name naming what it configures,
              since the adjacent label span is a separate element. */}
          <SearchSelect
            options={[{ value: '', label: t('roles.startDashboardNone') }, ...DASHBOARD_TYPES.map(dt => ({ value: dt, label: td(`types.${dt}`) }))]}
            selected={[localRole.dashboard_type ?? '']}
            onToggle={v => saveAppearance({ dashboard_type: v || null })}
            closeOnToggle
            triggerLabel={localRole.dashboard_type ? td(`types.${localRole.dashboard_type}`) : t('roles.startDashboardNone')}
            triggerAriaLabel={t('roles.startDashboard')}
          />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <RoleChip name={localRole.name} color={color} icon={iconName} />
        </div>
      </div>

      {/* Branch template — the starting set new users with this role inherit (§ USERS-ROLES-LOC-1) */}
      <RoleBranchTemplate roleId={localRole.id} />

      {/* Rights list — HelloFlex-style expandable rows, one per permission group */}
      <PermissionMatrix groups={groups} hasPermission={hasPermission} onToggle={togglePermission} onSetMany={setManyPermissions} />
    </div>
  )
}
