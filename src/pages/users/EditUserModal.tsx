/**
 * EditUserModal — edit an existing user's profile fields (PATCH /users/{id}).
 * Name, e-mail, phone, and optional password reset. Role is changed inline in the table.
 */
import { useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import type { ManagedUser } from '@/types/api'

export default function EditUserModal({ user, onClose, onSaved }: {
  user: ManagedUser
  onClose: () => void
  onSaved: (updated: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
  // Fallback: split `name` when firstname/lastname arrive as a single string.
  const nameParts = (user.name ?? '').split(' ')
  const [form, setForm] = useState({
    firstname: user.firstname ?? nameParts[0] ?? '',
    lastname:  user.lastname  ?? nameParts.slice(1).join(' ') ?? '',
    email:     user.email     ?? '',
    phone:     user.phone     ?? '',
    password:  '',
  })
  const [changePassword, setChangePassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const payload: Record<string, string> = {
        firstname: form.firstname,
        lastname:  form.lastname,
        email:     form.email,
        phone:     form.phone,
      }
      if (changePassword && form.password) payload.password = form.password
      const res = await api.patch(`/users/${user.id}`, payload)
      onSaved(res.data?.data ?? res.data)
      onClose()
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string } } }
      setError(e2.response?.data?.message ?? t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5,
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="fixed z-50" style={{
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        width: 420, padding: 24,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
            {t('editUser')}
            {(user.firstname || user.name) && (
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>
                {user.firstname ? `${user.firstname} ${user.lastname ?? ''}`.trim() : user.name}
              </span>
            )}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t('firstName')}</label>
              <input required value={form.firstname} onChange={set('firstname')} style={inputStyle} placeholder="Jan" aria-label={t('firstName')} />
            </div>
            <div>
              <label style={labelStyle}>{t('lastName')}</label>
              <input value={form.lastname} onChange={set('lastname')} style={inputStyle} placeholder="Jansen" aria-label={t('lastName')} />
            </div>
          </div>

          {/* E-mail */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t('email')}</label>
            <input required type="email" value={form.email} onChange={set('email')} style={inputStyle} aria-label={t('email')} />
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t('phone')}</label>
            <input type="tel" value={form.phone} onChange={set('phone')} style={inputStyle} placeholder="+31 6 …" aria-label={t('phone')} />
          </div>

          {/* Optional password reset */}
          <div style={{ marginBottom: changePassword ? 12 : 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={changePassword} onChange={e => setChangePassword(e.target.checked)} />
              {t('changePassword')}
            </label>
          </div>
          {changePassword && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>{t('newPassword')}</label>
              <input type="password" required={changePassword} value={form.password}
                onChange={set('password')} style={inputStyle} placeholder={t('pwPlaceholder')} aria-label={t('newPassword')} />
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>}

          {/* Actions */}
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
              {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t('saving')}</> : t('common:save')}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
