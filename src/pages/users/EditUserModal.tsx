/**
 * EditUserModal — edit an existing user's profile fields (PATCH /users/{id}),
 * plus the user's branch coupling (USERS-ROLES-LOC-1, GET/PUT /users/{id}/branches).
 * Branches live only here (not the table) — GET /users doesn't carry them, so a
 * table column would mean an N+1 fetch per row; mirrors RolesSettings, which
 * shows its branch template only in the per-role detail, never the roles list.
 * Role is changed inline in the table.
 */
import { useState } from 'react'
import type { ChangeEvent, CSSProperties, FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { useLocations } from '@/lib/useLocations'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import Button from '@/components/ui/Button'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { useUserBranches } from './hooks/useUserBranches'
import type { ManagedUser } from '@/types/api'
import { PageTitle, Caption } from '@/components/ui/typography'

// VALIDATIE-LIVE-1-rest: `email` is the only field here the backend validates
// with a shape rule (UserController's inline PATCH rules — `'email' =>
// 'sometimes|email|unique:...'`) — `phone` stays a plain string server-side
// (`'sometimes|nullable|string|max:32'`), so no live format gate is added for
// it (see src/lib/contactFieldValidation.ts for the full verification note).
const EMAIL_VALIDATORS = { email: isValidEmailFormat }
const EMAIL_ERROR_KEYS = { email: 'validation.emailFormat' }

export default function EditUserModal({ user, onClose, onSaved }: {
  user: ManagedUser
  onClose: () => void
  onSaved: (updated: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
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
  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for email — own
  // sibling hook, same idiom as AddCandidateModal.
  const { markTouched, fieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // VALIDATIE-LIVE-1-rest: block on a live format failure too — marks any
    // untouched-but-malformed field touched so its message renders.
    if (touchInvalidFields().length) return
    setSaving(true); setError(null)
    try {
      const payload: Record<string, string> = {
        firstname: form.firstname,
        lastname:  form.lastname,
        email:     form.email,
        phone:     form.phone,
      }
      if (changePassword && form.password) payload.password = form.password
      // PUT because that is what the generated contract documents (operations
      // .putUsersUserId; the spec lists no patch for this path). The live route accepts
      // BOTH verbs — Route::match(['put','patch'], 'users/{user}') — so the previous
      // PATCH was not failing; this simply follows the documented contract, which is
      // what a spec-driven client should send. Verified 28-07.
      const res = await api.put(`/users/${user.id}`, payload)
      onSaved(unwrap(res))
      onClose()
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string } } }
      setError(e2.response?.data?.message ?? t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  // Canon field style (G33/fieldMetrics) — was its own padding-8/radius-8 copy.
  const inputStyle: CSSProperties = fieldInputStyle
  const labelStyle: CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 5,
  }

  return (
    // POPUP-SLEEP-1: migrated onto the shared FloatingPanel shell — draggable
    // header, SE-resize, remembered position; same 420px footprint as before.
    <FloatingPanel open onClose={onClose} ariaLabel={t('editUser')}
      persistKey="edit-user" width={420} bodyStyle={{ padding: '20px 24px 24px' }}
      header={
        <PageTitle as="h3" style={{ fontWeight: 700, flex: 1 }}>
          {t('editUser')}
          {(user.firstname || user.name) && (
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 13 }}>
              {user.firstname ? `${user.firstname} ${user.lastname ?? ''}`.trim() : user.name}
            </span>
          )}
        </PageTitle>
      }>
        <form onSubmit={handleSubmit}>
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t('firstName')}</label>
              <input required value={form.firstname} onChange={set('firstname')} style={inputStyle} placeholder={t('common:placeholders.firstName')} aria-label={t('firstName')} />
            </div>
            <div>
              <label style={labelStyle}>{t('lastName')}</label>
              <input value={form.lastname} onChange={set('lastname')} style={inputStyle} placeholder={t('common:placeholders.lastName')} aria-label={t('lastName')} />
            </div>
          </div>

          {/* E-mail — VALIDATIE-LIVE-1-rest: blur marks it touched so a live
              format error renders inline instead of only bouncing back as a 422. */}
          <div style={{ marginBottom: 12 }} onBlur={() => markTouched('email')}>
            <label style={labelStyle}>{t('email')}</label>
            <input required type="email" value={form.email} onChange={set('email')} aria-label={t('email')}
              style={{ ...inputStyle, ...(fieldMessage('email') ? { borderColor: 'var(--color-danger)' } : {}) }} />
            {fieldMessage('email') && <p style={{ fontSize: 11, color: 'var(--color-danger-text)', marginTop: 5 }}>{fieldMessage('email')}</p>}
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t('phone')}</label>
            <input type="tel" value={form.phone} onChange={set('phone')} style={inputStyle} placeholder={t('common:placeholders.phoneExample')} aria-label={t('phone')} />
          </div>

          {/* Branches (USERS-ROLES-LOC-1) — current coupling, editable via the shared
              chip multi-select; a non-empty set already hard-scopes this user's
              candidate visibility (VESTIGING-1 fase 2), so the hint below says so. */}
          <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--hover-bg)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('branches.title')}</span>
              {branchesSaving && <span style={{ color: 'var(--text-muted)' }}><Spinner size={12} /></span>}
            </div>
            <Caption as="p" style={{ marginBottom: 10 }}>{t('branches.hint')}</Caption>
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
              <Caption as="p" style={{ marginTop: 8 }}>{t('branches.emptyHint')}</Caption>
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

          {error && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={saving || hasFormatError}>
              {saving ? <><Spinner size={13} /> {t('saving')}</> : t('common:save')}
            </Button>
          </div>
        </form>
    </FloatingPanel>
  )
}
