/**
 * usersParts — presentational pieces of the users page, extracted to keep
 * UsersPage a thin container (§3 size discipline): role badge + inline role
 * changer, the editable colour avatar, and the small role helpers/meta.
 */
import { useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Shield, User, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { notifyError } from '@/lib/notify'
import { COLOR_PRESETS } from '@/lib/colorPresets'
import RoleChip from '@/components/ui/RoleChip'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import type { ManagedUser } from '@/types/api'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import { useEscapeLayer } from '@/hooks/useEscapeLayer'

// A role reference as it can appear on a user: a bare name or a role object
// (the backend now carries colour + icon on the object).
export type RoleRef = string | { name?: string; color?: string | null; icon?: string | null }
// An available role from /roles (for the inline role-changer).
export interface AvailableRole { id: string | number; name: string }
// Loose translation function (the i18next TFunction is assignable to this).
type TFunc = (key: string, opts?: Record<string, unknown>) => string

// Resolve a role reference to its name (a bare-string role is its own name).
// eslint-disable-next-line react-refresh/only-export-components -- pure helper shared by many callers (UsersPage, UsersTable, NewUserModal, hooks, …); relocating touches nine unrelated files
export const roleName = (r: RoleRef): string | undefined => typeof r === 'string' ? r : r.name

// Super-admin accent colour — the shared violet token, also used by the "system" badge.
export const SUPER_ADMIN_COLOR = 'var(--color-violet)'

// Role → fallback colour + icon (data palette; a backend-supplied role colour wins).
// Label = t('roles.<name>') (default → user).
/* eslint-disable no-restricted-syntax -- DATA: role fallback colour palette, a backend-supplied colour always wins */
const ROLE_META: Record<string, { color: string; icon: LucideIcon }> = {
  super_admin:   { color: SUPER_ADMIN_COLOR, icon: ShieldCheck },
  tenant_admin:  { color: '#1D4ED8', icon: Shield },
  planner:       { color: '#065F46', icon: User },
  default:       { color: '#6B7280', icon: User },
}
/* eslint-enable no-restricted-syntax */
// Exported so NewUserModal can label roles the same way (seeded roles get the
// translated name; custom tenant roles fall back to their own raw name).
// FIX (was `users.roles.<name>`, a dead key — users.json has no top-level "users"
// object, so this always silently fell through to the raw role name): the seed
// labels live at `roles.<name>` directly in the `users` namespace.
// eslint-disable-next-line react-refresh/only-export-components -- pure helper, same shared-caller reasoning as roleName above
export const roleLabel = (t: TFunc, name: string) => t(`roles.${name === 'default' ? 'user' : name}`, { defaultValue: name })

// Icon-name fallback for the seeded/system roles (before a tenant sets an icon).
const LEGACY_ICON: Record<string, string> = {
  super_admin: 'shield-check', tenant_admin: 'shield', planner: 'user', default: 'user',
}

const hasRole = (u: ManagedUser | undefined, role: string) => (u?.roles ?? []).some(r => roleName(r) === role)
// eslint-disable-next-line react-refresh/only-export-components -- pure helper, same shared-caller reasoning as roleName above
export const isSuperAdminUser = (u: ManagedUser) => hasRole(u, 'super_admin')

// RoleBadge — the role as a coloured chip with its icon. Colour/icon come from the
// role object when present (backend); otherwise the seeded ROLE_META fallback.
export function RoleBadge({ role }: { role: RoleRef }) {
  const { t } = useTranslation('users')
  const obj = typeof role === 'string' ? {} : (role ?? {})
  const name = typeof role === 'string' ? role : role?.name ?? 'default'
  const meta = ROLE_META[name] ?? ROLE_META.default
  const color = obj.color ?? meta.color
  const icon = obj.icon ?? LEGACY_ICON[name] ?? 'user'
  return <RoleChip name={roleLabel(t, name)} title={name} color={color} icon={icon} size={10} />
}

// Inline role-changer shown when clicking the role cell of a non-super-admin user.
// Loads available roles from /roles and sends PUT /users/{id}/roles.
export function RoleSelector({ user: u, availableRoles, onChanged }: {
  user: ManagedUser
  availableRoles: AvailableRole[]
  onChanged: (updated: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Open below the button via a portal so the menu escapes the table's `overflow: hidden`.
  const toggle = () => {
    if (!open) { const r = btnRef.current?.getBoundingClientRect(); if (r) setMenuPos({ top: r.bottom + 4, left: r.left }) }
    setOpen(o => !o)
  }

  const currentRoleName = (u.roles ?? [])
    .map(roleName)
    .find(n => n && n !== 'super_admin') ?? null

  // Replaces the user's role set with this single role, via the same PUT
  // /users/{id}/roles route UserRolesModal uses.
  const assign = async (roleId: string | number) => {
    setSaving(true)
    setOpen(false)
    try {
      const res = await api.put(`/users/${u.id}/roles`, { roles: [roleId] })
      onChanged(unwrap(res))
    } catch {
      // A 403 (insufficient permission) or validation error left this completely
      // silent before — the menu just closed with nothing changed, no clue why (§3).
      notifyError(t('changeRoleFailed'))
    }
    setSaving(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {(u.roles ?? [])
        .filter(r => roleName(r) !== 'super_admin')
        .map((r, i) => <RoleBadge key={i} role={r} />)}
      {(u.roles ?? []).filter(r => roleName(r) !== 'super_admin').length === 0 && (
        <RoleBadge role="default" />
      )}

      {/* Change role button — design tokens so it themes per tenant/dark mode */}
      <button ref={btnRef} onClick={toggle} disabled={saving}
        title={t('changeRole')} aria-label={t('changeRole')}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- compact 22×22 inline trigger sized to sit beside the role chips, not a Button
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                 width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)',
                 background: open ? 'var(--hover-bg)' : 'var(--surface)', cursor: 'pointer',
                 color: 'var(--text-muted)', marginLeft: 2 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
        onMouseLeave={e => !open && (e.currentTarget.style.color = 'var(--text-muted)')}>
        {saving
          ? <Spinner size={11} />
          : <ChevronDown size={11} />}
      </button>

      {open && menuPos && createPortal(
        <>
          {/* Invisible click-catcher + the portalled menu — both on the CSS popover
              rung (mirrors SelectMenu/CreatableSelect), DOM order puts the menu on top. */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-popover)' }} />
          <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 'var(--z-popover)',
                         background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                         boxShadow: 'var(--shadow-float)', minWidth: 160, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                           textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>
              {t('changeRole')}
            </div>
            {availableRoles.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('noRoles')}</div>
            )}
            {availableRoles.map(role => {
              const meta    = ROLE_META[role.name] ?? ROLE_META.default
              const isCurrent = role.name === currentRoleName
              return (
                <button key={role.id} onClick={() => assign(role.id)}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- menu-item row, not a Button
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                           padding: '9px 12px', border: 'none', textAlign: 'left', cursor: 'pointer',
                           background: isCurrent ? 'var(--hover-bg)' : 'transparent',
                           // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                           fontSize: 13, color: isCurrent ? 'var(--color-primary-text)' : 'var(--text)',
                           fontWeight: isCurrent ? 600 : 400 }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%',
                                 background: meta.color, flexShrink: 0 }} />
                  {roleLabel(t, role.name)}
                  {isCurrent && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-primary-text)' }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// Derive up-to-2 initials from name parts, falling back to the e-mail.
function avatarInitials(u: ManagedUser) {
  return (
    [u.firstname, u.lastname].filter((n): n is string => Boolean(n)).map(n => n[0]).join('').toUpperCase()
    || (u.name ?? '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    || (u.email ?? '').slice(0, 2).toUpperCase()
    || '?'
  )
}

// Round initials bubble, soft-tinted with the user's chosen `avatar_color` (neutral
// primary tint when none). When `onPick` is given it doubles as a colour picker
// (click → soft palette popup) so recruiter icons get a recognisable, settable colour.
export function EditableAvatar({ user: u, onPick }: { user: ManagedUser; onPick?: (color: string | null) => void }) {
  const { t } = useTranslation('users')
  const [open, setOpen] = useState(false)
  const c = u.avatar_color || null
  // Escape layer: closes the colour picker (non-modal popover; outside-click also closes; one-stage).
  useEscapeLayer(open, () => setOpen(false))
  // Non-chip tinted surface (an avatar bubble) — the house tintBg/tintBorder
  // formula applies here rather than SoftChip (§4, HUISSTIJL-1).
  const bubble: CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
    background: c ? tintBg(c) : 'var(--color-primary-bg)',
    // Initials ink via chipInk — 11px/700 is not WCAG "large", and the raw colour
    // on its own tint read 2.3-3.8:1 (herhaal-slotaudit r3).
    color: c ? chipInk(c) : 'var(--color-primary-text)',
    border: c ? tintBorder(c) : '1px solid transparent',
  }
  if (!onPick) return <div style={bubble}>{avatarInitials(u)}</div>

  // Commit a colour (or null = back to the auto/initials colour) and close.
  const choose = (color: string | null) => { setOpen(false); onPick(color) }
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title={t('avatarColor')} aria-label={t('avatarColor')}
        // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- avatar swatch trigger (its own fill IS the user's picked colour), not a Button
        style={{ ...bubble, cursor: 'pointer', padding: 0 }}>
        {avatarInitials(u)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 'var(--z-overlay)' }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: 36, left: 0, zIndex: 'var(--z-popover)', width: 192,
                         background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                         padding: 12, boxShadow: 'var(--shadow-float)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_PRESETS.map(col => (
                <button key={col} onClick={() => choose(col)} aria-label={col}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- DATA: preset swatch, its own fill IS the colour value, not a Button
                  style={{ width: 26, height: 26, borderRadius: 6, background: col, cursor: 'pointer',
                           border: col.toUpperCase() === (c ?? '').toUpperCase() ? '2px solid var(--text)' : '2px solid transparent' }} />
              ))}
            </div>
            <Button variant="secondary" onClick={() => choose(null)} style={{ marginTop: 10, width: '100%' }}>
              {t('avatarColorAuto')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// A branch row as returned by GET /users/{id}/branches and /roles/{id}/branches
// (USERS-ROLES-LOC-1) — name is the location's display name, resolved server-side.
export interface BranchRow { location_id: string | number; name?: string | null }

// BranchChips — read-only soft-tinted chips for a fixed branch set (no toggle):
// the role-template preview in NewUserModal and, at a glance, "what this user is
// currently coupled to". Editing itself happens via the shared ChipMultiSelect
// (components/ui) against the full location list — this is display-only.
export function BranchChips({ branches, emptyText }: { branches: BranchRow[]; emptyText?: string }) {
  if (branches.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emptyText ?? '—'}</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {branches.map(b => (
        <span key={b.location_id}
          style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                   background: 'var(--color-primary-bg)', color: 'var(--color-primary-text)',
                   border: '1px solid var(--color-primary)' }}>
          {b.name ?? '—'}
        </span>
      ))}
    </div>
  )
}
