/**
 * usersParts — presentational pieces of the users page, extracted to keep
 * UsersPage a thin container (§3 size discipline): role badge + inline role
 * changer, the editable colour avatar, and the small role helpers/meta.
 */
import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Shield, User, Loader2, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { COLOR_PRESETS } from '@/lib/colorPresets'
import RoleChip from '@/components/ui/RoleChip'
import type { ManagedUser } from '@/types/api'

// A role reference as it can appear on a user: a bare name or a role object
// (the backend now carries colour + icon on the object).
export type RoleRef = string | { name?: string; color?: string | null; icon?: string | null }
// An available role from /roles (for the inline role-changer).
export interface AvailableRole { id: string | number; name: string }
// Loose translation function (the i18next TFunction is assignable to this).
type TFunc = (key: string, opts?: Record<string, unknown>) => string

// Resolve a role reference to its name (a bare-string role is its own name).
export const roleName = (r: RoleRef): string | undefined => typeof r === 'string' ? r : r.name

// Super-admin accent colour — the shared violet token, also used by the "system" badge.
export const SUPER_ADMIN_COLOR = 'var(--color-violet)'

// Role → fallback colour + icon (data palette; a backend-supplied role colour wins).
// Label = t('roles.<name>') (default → user).
const ROLE_META: Record<string, { color: string; icon: LucideIcon }> = {
  super_admin:   { color: SUPER_ADMIN_COLOR, icon: ShieldCheck },
  tenant_admin:  { color: '#1D4ED8', icon: Shield },
  planner:       { color: '#065F46', icon: User },
  default:       { color: '#6B7280', icon: User },
}
// Exported so NewUserModal can label roles the same way (seeded roles get the
// translated name; custom tenant roles fall back to their own raw name).
// FIX (was `users.roles.<name>`, a dead key — users.json has no top-level "users"
// object, so this always silently fell through to the raw role name): the seed
// labels live at `roles.<name>` directly in the `users` namespace.
export const roleLabel = (t: TFunc, name: string) => t(`roles.${name === 'default' ? 'user' : name}`, { defaultValue: name })

// Icon-name fallback for the seeded/system roles (before a tenant sets an icon).
const LEGACY_ICON: Record<string, string> = {
  super_admin: 'shield-check', tenant_admin: 'shield', planner: 'user', default: 'user',
}

const hasRole = (u: ManagedUser | undefined, role: string) => (u?.roles ?? []).some(r => roleName(r) === role)
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

  const assign = async (roleId: string | number) => {
    setSaving(true)
    setOpen(false)
    try {
      const res = await api.put(`/users/${u.id}/roles`, { roles: [roleId] })
      onChanged(unwrap(res))
    } catch { /* noop */ }
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
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                 width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)',
                 background: open ? 'var(--hover-bg)' : 'var(--surface)', cursor: 'pointer',
                 color: 'var(--text-muted)', marginLeft: 2 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
        onMouseLeave={e => !open && (e.currentTarget.style.color = 'var(--text-muted)')}>
        {saving
          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
          : <ChevronDown size={11} />}
      </button>

      {open && menuPos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 61,
                         background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                         boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 160, overflow: 'hidden' }}>
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
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                           padding: '9px 12px', border: 'none', textAlign: 'left', cursor: 'pointer',
                           background: isCurrent ? 'var(--hover-bg)' : 'transparent',
                           fontSize: 13, color: isCurrent ? 'var(--color-primary)' : 'var(--text)',
                           fontWeight: isCurrent ? 600 : 400 }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%',
                                 background: meta.color, flexShrink: 0 }} />
                  {roleLabel(t, role.name)}
                  {isCurrent && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-primary)' }}>✓</span>
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
  // Close the colour picker on Escape (non-modal popover; outside-click also closes).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const bubble: CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
    background: c ? c + '22' : 'var(--color-primary-bg)',
    color: c || 'var(--color-primary)',
    border: c ? `1px solid ${c}55` : '1px solid transparent',
  }
  if (!onPick) return <div style={bubble}>{avatarInitials(u)}</div>

  // Commit a colour (or null = back to the auto/initials colour) and close.
  const choose = (color: string | null) => { setOpen(false); onPick(color) }
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title={t('avatarColor')} aria-label={t('avatarColor')}
        style={{ ...bubble, cursor: 'pointer', padding: 0 }}>
        {avatarInitials(u)}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: 36, left: 0, zIndex: 20, width: 192,
                         background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                         padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_PRESETS.map(col => (
                <button key={col} onClick={() => choose(col)} aria-label={col}
                  style={{ width: 26, height: 26, borderRadius: 6, background: col, cursor: 'pointer',
                           border: col.toUpperCase() === (c ?? '').toUpperCase() ? '2px solid var(--text)' : '2px solid transparent' }} />
              ))}
            </div>
            <button onClick={() => choose(null)}
              style={{ marginTop: 10, width: '100%', fontSize: 12, color: 'var(--text-muted)', background: 'none',
                       border: '1px solid var(--border)', borderRadius: 7, padding: '5px 0', cursor: 'pointer' }}>
              {t('avatarColorAuto')}
            </button>
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
                   background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                   border: '1px solid var(--color-primary)' }}>
          {b.name ?? '—'}
        </span>
      ))}
    </div>
  )
}
