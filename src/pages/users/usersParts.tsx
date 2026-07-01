/**
 * usersParts — presentational pieces of the users page, extracted to keep
 * UsersPage a thin container (§3 size discipline): role badge + inline role
 * changer, the editable colour avatar, and the small role helpers/meta.
 */
import { useState, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Shield, User, Loader2, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import api from '../../lib/api'
import { COLOR_PRESETS } from '../../lib/colorPresets'
import type { ManagedUser } from '@/types/api'

// A role reference as it can appear on a user: a bare name or a role object.
export type RoleRef = string | { name?: string }
// An available role from /roles (for the inline role-changer).
export interface AvailableRole { id: string | number; name: string }
// Loose translation function (the i18next TFunction is assignable to this).
type TFunc = (key: string, opts?: Record<string, unknown>) => string

// Resolve a role reference to its name (a bare-string role is its own name).
export const roleName = (r: RoleRef): string | undefined => typeof r === 'string' ? r : r.name

// Role → colour + icon. Label = t('users.roles.<name>') (default → user).
const ROLE_META: Record<string, { color: string; bg: string; icon: LucideIcon }> = {
  super_admin:   { color: '#7C3AED', bg: '#F5F3FF', icon: ShieldCheck },
  tenant_admin:  { color: '#1D4ED8', bg: 'var(--color-secondary-bg)', icon: Shield },
  planner:       { color: '#065F46', bg: '#ECFDF5', icon: User },
  default:       { color: '#6B7280', bg: '#F9FAFB', icon: User },
}
const roleLabel = (t: TFunc, name: string) => t(`users.roles.${name === 'default' ? 'user' : name}`, { defaultValue: name })

const hasRole = (u: ManagedUser | undefined, role: string) => (u?.roles ?? []).some(r => roleName(r) === role)
export const isSuperAdminUser = (u: ManagedUser) => hasRole(u, 'super_admin')

export function RoleBadge({ role }: { role: RoleRef }) {
  const { t } = useTranslation('users')
  const name = typeof role === 'string' ? role : role?.name ?? 'default'
  const meta = ROLE_META[name] ?? ROLE_META.default
  const Icon = meta.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: meta.bg, color: meta.color,
      border: `1px solid ${meta.color}22`,
      borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 500,
    }}>
      <Icon size={10} />
      {roleLabel(t, name)}
    </span>
  )
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
      onChanged(res.data?.data ?? res.data)
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

      {/* Change role button */}
      <button ref={btnRef} onClick={toggle} disabled={saving}
        title={t('changeRole')} aria-label={t('changeRole')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                 width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E7EB',
                 background: open ? '#F3F4F6' : 'white', cursor: 'pointer',
                 color: '#9CA3AF', marginLeft: 2 }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
        onMouseLeave={e => !open && (e.currentTarget.style.color = '#9CA3AF')}>
        {saving
          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
          : <ChevronDown size={11} />}
      </button>

      {open && menuPos && createPortal(
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 61,
                         background: 'white', border: '1px solid #E5E7EB', borderRadius: 10,
                         boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 160, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                           textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F3F4F6' }}>
              {t('changeRole')}
            </div>
            {availableRoles.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF' }}>{t('noRoles')}</div>
            )}
            {availableRoles.map(role => {
              const meta    = ROLE_META[role.name] ?? ROLE_META.default
              const isCurrent = role.name === currentRoleName
              return (
                <button key={role.id} onClick={() => assign(role.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                           padding: '9px 12px', border: 'none', textAlign: 'left', cursor: 'pointer',
                           background: isCurrent ? '#F9FAFB' : 'white',
                           fontSize: 13, color: isCurrent ? 'var(--color-primary)' : '#374151',
                           fontWeight: isCurrent ? 600 : 400 }}
                  onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'white' }}>
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
                         background: 'white', border: '1px solid #E5E7EB', borderRadius: 10,
                         padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_PRESETS.map(col => (
                <button key={col} onClick={() => choose(col)} aria-label={col}
                  style={{ width: 26, height: 26, borderRadius: 6, background: col, cursor: 'pointer',
                           border: col.toUpperCase() === (c ?? '').toUpperCase() ? '2px solid #111827' : '2px solid transparent' }} />
              ))}
            </div>
            <button onClick={() => choose(null)}
              style={{ marginTop: 10, width: '100%', fontSize: 12, color: '#6B7280', background: 'none',
                       border: '1px solid #E5E7EB', borderRadius: 7, padding: '5px 0', cursor: 'pointer' }}>
              {t('avatarColorAuto')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
