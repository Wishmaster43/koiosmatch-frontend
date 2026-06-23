/**
 * NewUserModal — create-user dialog (POST /users). Self-contained; ROLES lives here.
 * Extracted from UsersPage.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import api from '@/lib/api'

// Selectable roles in the new-user form; labels = t('users.roles.<value>').
const ROLES = ['tenant_admin', 'planner', 'user']

export default function NewUserModal({ onClose, onCreated }) {
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
