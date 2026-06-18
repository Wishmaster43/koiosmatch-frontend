/**
 * UsersPage — manage the users within the current tenant.
 * Lists users with search, shows their role badges, and lets an admin create a
 * new user (NewUserModal). Super-admin users are shown specially and protected.
 *
 * Main blocks below:
 *   - ROLES         → selectable roles in the new-user form
 *   - NewUserModal  → create-user dialog (POST /users)
 *   - (further down)→ the searchable user table + role rendering
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Shield, User, Plus, X, Loader2, ChevronDown } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useRightPanel } from '../../context/RightPanelContext'

// Selectable roles in the new-user form; labels = t('users.roles.<value>').
const ROLES = ['tenant_admin', 'planner', 'user']

function NewUserModal({ onClose, onCreated }) {
  const { t } = useTranslation('users')
  const [form, setForm]     = useState({ firstname: '', lastname: '', email: '', password: '', role: 'planner' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const res = await api.post('/users', form)
      onCreated(res.data?.data ?? res.data)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.message ?? t('createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const input = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--input-bg)',
                  color: 'var(--text)', outline: 'none' }
  const label = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5 }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="fixed z-50" style={{
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        width: 420, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('newUser')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>{t('firstName')}</label>
              <input required value={form.firstname} onChange={set('firstname')} style={input} placeholder="Jan" />
            </div>
            <div>
              <label style={label}>{t('lastName')}</label>
              <input value={form.lastname} onChange={set('lastname')} style={input} placeholder="Jansen" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{t('email')}</label>
            <input required type="email" value={form.email} onChange={set('email')} style={input} placeholder="jan@bedrijf.nl" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>{t('password')}</label>
            <input required type="password" value={form.password} onChange={set('password')} style={input} placeholder={t('pwPlaceholder')} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={label}>{t('role')}</label>
            <select value={form.role} onChange={set('role')} style={{ ...input, cursor: 'pointer' }}>
              {ROLES.map(r => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
            </select>
          </div>

          {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                       background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                       background: 'var(--color-primary)', color: 'white', cursor: saving ? 'default' : 'pointer',
                       display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t('creating')}</> : t('create')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// Role → colour + icon. Label = t('users.roles.<name>') (default → user).
const ROLE_META = {
  super_admin:   { color: '#7C3AED', bg: '#F5F3FF', icon: ShieldCheck },
  tenant_admin:  { color: '#1D4ED8', bg: 'var(--color-secondary-bg)', icon: Shield },
  planner:       { color: '#065F46', bg: '#ECFDF5', icon: User },
  default:       { color: '#6B7280', bg: '#F9FAFB', icon: User },
}
const roleLabel = (t, name) => t(`users.roles.${name === 'default' ? 'user' : name}`, { defaultValue: name })

const hasRole = (u, role) => (u?.roles ?? []).some(r => (typeof r === 'string' ? r : r?.name) === role)
const isSuperAdminUser = u => hasRole(u, 'super_admin')

function RoleBadge({ role }) {
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
function RoleSelector({ user: u, availableRoles, onChanged }) {
  const { t } = useTranslation('users')
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)

  const currentRoleName = (u.roles ?? [])
    .map(r => typeof r === 'string' ? r : r?.name)
    .find(n => n && n !== 'super_admin') ?? null

  const assign = async (roleId) => {
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
        .filter(r => (typeof r === 'string' ? r : r?.name) !== 'super_admin')
        .map((r, i) => <RoleBadge key={i} role={r} />)}
      {(u.roles ?? []).filter(r => (typeof r === 'string' ? r : r?.name) !== 'super_admin').length === 0 && (
        <RoleBadge role="default" />
      )}

      {/* Change role button */}
      <button onClick={() => setOpen(o => !o)} disabled={saving}
        title={t('changeRole')}
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

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
                         background: 'white', border: '1px solid #E5E7EB', borderRadius: 10,
                         boxShadow: '0 4px 20px rgba(0,0,0,0.1)', minWidth: 160, overflow: 'hidden' }}>
            <div style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                           textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F3F4F6' }}>
              {t('changeRole')}
            </div>
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
        </>
      )}
    </div>
  )
}

function Avatar({ user: u }) {
  const initials = (
    [u.firstname, u.lastname].filter(Boolean).map(n => n[0]).join('').toUpperCase()
    || (u.name ?? '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    || (u.email ?? '').slice(0, 2).toUpperCase()
    || '?'
  )
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
      background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700,
    }}>
      {initials}
    </div>
  )
}

const TH = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
  color: '#9CA3AF', background: '#FAFAFA', borderBottom: '1px solid #F3F4F6',
  whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em',
}
const TD = { padding: '10px 14px', borderBottom: '1px solid #F9FAFB', verticalAlign: 'middle' }

export default function UsersPage() {
  const { t } = useTranslation('users')
  const { user: me } = useAuth()
  const [users,        setUsers]        = useState([])
  const [roles,        setRoles]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [selectedRole, setSelectedRole] = useState([])
  const { registerFilters, unregisterFilters } = useRightPanel()

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/roles')])
      .then(([usersRes, rolesRes]) => {
        const list = usersRes.data?.data ?? usersRes.data ?? []
        setUsers(Array.isArray(list) ? list : [])
        const roleList = rolesRes.data ?? []
        setRoles(roleList.filter(r => r.name !== 'super_admin' && r.name !== 'tenant_admin'))
      })
      .catch(err => setError(err?.response?.status === 403 ? t('noAccess') : t('loadError')))
      .finally(() => setLoading(false))
  }, [])

  const roleOptions = useMemo(() => [...new Set(users.flatMap(u => (u.roles ?? []).map(r => r.name)))].map(r => ({ value: r, label: r, count: users.filter(u => (u.roles ?? []).some(x => x.name === r)).length })), [users])

  const filterGroups = useMemo(() => [
    { key: 'role', label: t('filterRole'), selected: selectedRole, options: roleOptions, onToggle: v => setSelectedRole(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]) },
  ], [t, selectedRole, roleOptions])

  useEffect(() => {
    registerFilters('users-page', filterGroups)
    return () => unregisterFilters('users-page')
  }, [filterGroups, registerFilters, unregisterFilters])

  const filtered = useMemo(() => {
    if (!selectedRole.length) return users
    return users.filter(u => selectedRole.some(r => (u.roles ?? []).some(x => x.name === r)))
  }, [users, selectedRole])

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
                      <Avatar user={u} />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {name}
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
    </div>
  )
}
