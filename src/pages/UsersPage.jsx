import { useState, useEffect, useMemo } from 'react'
import { Search, ShieldCheck, Shield, User, Plus, X, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

const ROLES = [
  { value: 'tenant_admin', label: 'Admin' },
  { value: 'planner',      label: 'Planner' },
  { value: 'user',         label: 'Gebruiker' },
]

function NewUserModal({ onClose, onCreated }) {
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
      setError(err?.response?.data?.message ?? 'Aanmaken mislukt.')
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Nieuwe gebruiker</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={label}>Voornaam</label>
              <input required value={form.firstname} onChange={set('firstname')} style={input} placeholder="Jan" />
            </div>
            <div>
              <label style={label}>Achternaam</label>
              <input value={form.lastname} onChange={set('lastname')} style={input} placeholder="Jansen" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>E-mailadres</label>
            <input required type="email" value={form.email} onChange={set('email')} style={input} placeholder="jan@bedrijf.nl" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={label}>Wachtwoord</label>
            <input required type="password" value={form.password} onChange={set('password')} style={input} placeholder="Minimaal 8 tekens" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={label}>Rol</label>
            <select value={form.role} onChange={set('role')} style={{ ...input, cursor: 'pointer' }}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {error && <p style={{ fontSize: 12, color: '#EF4444', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                       background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Annuleren
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                       background: 'var(--color-primary)', color: 'white', cursor: saving ? 'default' : 'pointer',
                       display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Aanmaken…</> : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

const ROLE_META = {
  super_admin:   { label: 'Super admin', color: '#7C3AED', bg: '#F5F3FF', icon: ShieldCheck },
  tenant_admin:  { label: 'Admin',       color: '#1D4ED8', bg: '#EFF6FF', icon: Shield },
  planner:       { label: 'Planner',     color: '#065F46', bg: '#ECFDF5', icon: User },
  default:       { label: 'Gebruiker',   color: '#6B7280', bg: '#F9FAFB', icon: User },
}

function RoleBadge({ role }) {
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
      {meta.label}
    </span>
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
  const { user: me } = useAuth()
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [search,     setSearch]     = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    api.get('/users')
      .then(res => {
        const list = res.data?.data ?? res.data ?? []
        setUsers(Array.isArray(list) ? list : [])
      })
      .catch(err => setError(err?.response?.status === 403 ? 'Geen toegang tot gebruikerslijst.' : 'Kon gebruikers niet laden.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u => {
      const fullName = [u.firstname, u.lastname, u.name].filter(Boolean).join(' ')
      return (
        fullName.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, search])

  return (
    <div style={{ padding: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            Gebruikers
          </h2>
          {!loading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {filtered.length} van {users.length} gebruikers
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 8, width: 240 }}>
            <Search size={13} color="#9CA3AF" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam of e-mail…"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
                       fontSize: 12, color: 'var(--text)' }} />
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                     fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
                     background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> Nieuwe gebruiker
          </button>
        </div>
      </div>

      {/* Tabel */}
      <div style={{ background: 'var(--surface)', borderRadius: 12,
                    border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TH}>Naam</th>
              <th style={TH}>E-mail</th>
              <th style={TH}>Telefoon</th>
              <th style={TH}>Rol</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                Gebruikers ophalen…
              </td></tr>
            )}
            {!loading && error && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#EF4444', fontSize: 13 }}>
                {error}
              </td></tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
                Geen gebruikers gevonden
              </td></tr>
            )}
            {!loading && filtered.map((u, i) => {
              const fullName = [u.firstname, u.lastname].filter(Boolean).join(' ') || u.name || '—'
              const isMe = u.id === me?.id
              return (
                <tr key={u.id ?? i}
                  style={{ transition: 'background 0.1s', background: isMe ? 'var(--color-primary-bg)' : undefined }}
                  onMouseEnter={e => { if (!isMe) e.currentTarget.style.background = '#FAFAFA' }}
                  onMouseLeave={e => { if (!isMe) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ ...TD, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={u} />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {fullName}
                          {isMe && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-primary)',
                                           background: 'var(--color-primary-bg)', borderRadius: 999,
                                           padding: '1px 7px' }}>
                              jij
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...TD, minWidth: 200, color: 'var(--text-muted)', fontSize: 12 }}>
                    {u.email ?? '—'}
                  </td>
                  <td style={{ ...TD, minWidth: 140, color: 'var(--text-muted)', fontSize: 12 }}>
                    {u.phone ?? '—'}
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(u.roles ?? []).map((r, ri) => <RoleBadge key={ri} role={r} />)}
                      {(!u.roles || u.roles.length === 0) && <RoleBadge role="default" />}
                    </div>
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
