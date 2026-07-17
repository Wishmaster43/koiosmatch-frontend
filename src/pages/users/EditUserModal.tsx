/**
 * EditUserModal — edit an existing user's profile fields (PATCH /users/{id}),
 * plus the user's branch coupling (USERS-ROLES-LOC-1, GET/PUT /users/{id}/branches).
 * Branches live only here (not the table) — GET /users doesn't carry them, so a
 * table column would mean an N+1 fetch per row; mirrors RolesSettings, which
 * shows its branch template only in the per-role detail, never the roles list.
 * Role is changed inline in the table.
 */
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, RefreshCw } from 'lucide-react'
import api, { unwrap } from '@/lib/api'
import { BTN_H } from '@/config/buttonMetrics'
import { useLocations } from '@/lib/useLocations'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import { useUserBranches } from './hooks/useUserBranches'
import type { ManagedUser } from '@/types/api'

export default function EditUserModal({ user, onClose, onSaved }: {
  user: ManagedUser
  onClose: () => void
  onSaved: (updated: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
  const panelRef = useFocusTrap<HTMLDivElement>(onClose)
  const locationOptions = useLocations()
  const { branches, loading: branchesLoading, saving: branchesSaving, toggle: toggleBranch } = useUserBranches(user.id)
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
      onSaved(unwrap(res))
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
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('editUser')} tabIndex={-1}
        className="fixed z-50" style={{
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
          <button onClick={onClose} aria-label={t('common:close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
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

          {/* Branches (USERS-ROLES-LOC-1) — current coupling, editable via the shared
              chip multi-select; a non-empty set already hard-scopes this user's
              candidate visibility (VESTIGING-1 fase 2), so the hint below says so. */}
          <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--hover-bg)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('branches.title')}</span>
              {branchesSaving && <RefreshCw size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{t('branches.hint')}</p>
            {branchesLoading ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('branches.loading')}</p>
            ) : (
              // Locations are always UUID strings server-side; ChipMultiSelect's
              // ChipOption.value is typed as plain `string` (narrower than the
              // shared `Id` union `useLocations` returns) — normalise here.
              <ChipMultiSelect
                options={locationOptions.map(o => ({ value: String(o.value), label: o.label }))}
                selected={branches.map(b => String(b.location_id))}
                onToggle={toggleBranch}
                emptyText={t('branches.noLocations')}
              />
            )}
            {!branchesLoading && branches.length === 0 && locationOptions.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{t('branches.emptyHint')}</p>
            )}
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

          {/* Actions — BTN_H (§4/§9): one explicit height for every text/action button, everywhere. */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{ height: BTN_H, padding: '0 16px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                       background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {t('common:cancel')}
            </button>
            <button type="submit" disabled={saving}
              style={{ height: BTN_H, padding: '0 18px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none',
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
