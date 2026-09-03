/**
 * EditUserModal — edit an existing user's profile fields (PATCH /users/{id}),
 * plus the user's branch coupling (USERS-ROLES-LOC-1, GET/PUT /users/{id}/branches).
 * Branches live only here (not the table) — GET /users doesn't carry them, so a
 * table column would mean an N+1 fetch per row; mirrors RolesSettings, which
 * shows its branch template only in the per-role detail, never the roles list.
 * Role is changed inline in the table.
 */
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import api, { unwrap } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import FloatingPanel from '@/components/ui/FloatingPanel'
import Spinner from '@/components/ui/Spinner'
import { useLocations } from '@/lib/useLocations'
import ChipMultiSelect from '@/components/ui/ChipMultiSelect'
import ErrorBanner from '@/components/ui/ErrorBanner'
import FieldNotice from '@/components/ui/FieldNotice'
import Button from '@/components/ui/Button'
import { useLiveFieldValidation } from '@/hooks/useLiveFieldValidation'
import { isValidEmailFormat } from '@/lib/contactFieldValidation'
import { useUserBranches } from './hooks/useUserBranches'
import type { ManagedUser } from '@/types/api'
import { PageTitle, Caption, BodyText } from '@/components/ui/typography'
import Toggle from '@/components/ui/Toggle'
// FIELD-LAYOUT canon (Danny 13-08): every field is a label-LEFT row from the
// shared form kit, grouped into titled cards — mirrors AddCandidateModal's
// PersonalCard/ContactCard (src/pages/candidates/addmodal/).
import { FieldRow, TextField, CheckboxField } from '@/components/forms/fields'
import { cardHead, cardBox, row2 } from '@/components/ui/modalCards'

// VALIDATIE-LIVE-1-rest: `email` is the only field here the backend validates
// with a shape rule (UserController's inline PATCH rules — `'email' =>
// 'sometimes|email|unique:...'`) — `phone` stays a plain string server-side
// (`'sometimes|nullable|string|max:32'`), so no live format gate is added for
// it (see src/lib/contactFieldValidation.ts for the full verification note).
const EMAIL_VALIDATORS = { email: isValidEmailFormat }
const EMAIL_ERROR_KEYS = { email: 'validation.emailFormat' }

// The user edit modal: name/email/phone/password fields + the branch assignment list.
export default function EditUserModal({ user, onClose, onSaved }: {
  user: ManagedUser
  onClose: () => void
  onSaved: (updated: ManagedUser) => void
}) {
  const { t } = useTranslation('users')
  const auth = useAuth()
  const locationOptions = useLocations()
  const { branches, loading: branchesLoading, saving: branchesSaving, error: branchesError, toggle: toggleBranch, setFlag: setBranchFlag } = useUserBranches(user.id)
  // Fallback: split `name` when firstname/lastname arrive as a single string.
  const nameParts = (user.name ?? '').split(' ')
  const [form, setForm] = useState({
    firstname:      user.firstname ?? nameParts[0] ?? '',
    lastname:       user.lastname  ?? nameParts.slice(1).join(' ') ?? '',
    email:          user.email     ?? '',
    phone:          user.phone     ?? '',
    password:       '',
    currentPassword: '',
  })
  const [changePassword, setChangePassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  // Stale-diff fallback (mirrors useProfileForm): a 403 current_password_required
  // means the backend saw a credential change our local diff missed — force the
  // field to render regardless of what credentialChange itself computes.
  const [forceCurrentPassword, setForceCurrentPassword] = useState(false)
  // CredentialChangeGuard (CMBE 03-09): a SELF-edit that touches email or
  // password needs the account's current password re-entered — the admin
  // path (editing someone else) never does.
  const isSelf = String(auth?.user?.id ?? '') === String(user.id)
  const credentialChange = isSelf && (
    forceCurrentPassword ||
    (changePassword && form.password !== '') || form.email.trim() !== (user.email ?? '')
  )
  // VALIDATIE-LIVE-1-rest: live, on-blur/typing format check for email — own
  // sibling hook, same idiom as AddCandidateModal.
  const { markTouched, fieldMessage, touchInvalidFields, hasFormatError } =
    useLiveFieldValidation(form, t, EMAIL_VALIDATORS, EMAIL_ERROR_KEYS)

  // Form-field setter: the kit's TextField reports the new VALUE directly, not
  // a ChangeEvent like a native onChange handler would.
  const set = (k: keyof typeof form) => (v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  // Validates then PUTs the profile fields (+ password when changing it) and adopts
  // the server's saved copy.
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
      // CredentialChangeGuard: only sent when the guard actually applies —
      // an admin editing another user's record never carries this field.
      if (credentialChange) payload.current_password = form.currentPassword
      // PUT because that is what the generated contract documents (operations
      // .putUsersUserId; the spec lists no patch for this path). The live route accepts
      // BOTH verbs — Route::match(['put','patch'], 'users/{user}') — so the previous
      // PATCH was not failing; this simply follows the documented contract, which is
      // what a spec-driven client should send. Verified 28-07.
      const res = await api.put(`/users/${user.id}`, payload)
      onSaved(unwrap(res))
      onClose()
    } catch (err) {
      const e2 = err as { response?: { status?: number; data?: { message?: string; code?: string } } }
      // CredentialChangeGuard: match on the machine-readable `code`, never
      // on the (translatable, server-language) `message` text.
      if (e2.response?.status === 403 && e2.response?.data?.code === 'current_password_required') {
        setError(t('currentPasswordRequired'))
        setForceCurrentPassword(true)
      } else {
        setError(e2.response?.data?.message ?? t('saveFailed'))
      }
    } finally {
      setSaving(false)
    }
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
          {/* Personal — first/last name (FIELD-LAYOUT canon: label left, titled card). */}
          <div style={{ marginBottom: 12 }}>
            <div style={cardHead}>{t('cardPersonal')}</div>
            <div style={cardBox}>
              <div style={row2}>
                <FieldRow label={t('firstName')} required>
                  <TextField value={form.firstname} onChange={set('firstname')} placeholder={t('common:placeholders.firstName')} />
                </FieldRow>
                <FieldRow label={t('lastName')}>
                  <TextField value={form.lastname} onChange={set('lastname')} placeholder={t('common:placeholders.lastName')} />
                </FieldRow>
              </div>
            </div>
          </div>

          {/* Contact — email/phone. VALIDATIE-LIVE-1-rest: blur marks e-mail
              touched so a live format error renders inline instead of only
              bouncing back as a 422. */}
          <div style={{ marginBottom: 12 }}>
            <div style={cardHead}>{t('cardContact')}</div>
            <div style={cardBox}>
              <div onBlur={() => markTouched('email')}>
                <FieldRow label={t('email')} required>
                  <TextField type="email" value={form.email} onChange={set('email')} error={!!fieldMessage('email')} />
                </FieldRow>
                <FieldNotice text={fieldMessage('email')} />
              </div>
              <FieldRow label={t('phone')}>
                <TextField type="tel" value={form.phone} onChange={set('phone')} placeholder={t('common:placeholders.phoneExample')} />
              </FieldRow>
            </div>
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
            ) : branchesError ? (
              // Honest failure notice — never render the empty-set chip grid (which
              // would silently read as "unrestricted") after a failed GET; chips stay
              // disabled since toggle() itself also refuses while error is set.
              <ErrorBanner>{t('branches.loadError')}</ErrorBanner>
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
            {!branchesLoading && !branchesError && branches.length === 0 && locationOptions.length > 0 && (
              <Caption as="p" style={{ marginTop: 8 }}>{t('branches.emptyHint')}</Caption>
            )}

            {/* Per-branch abilities (USERS-ROLES-LOC-1 phase 3) — dormant until the
                tenant flips `branch_authz_enabled` in Settings → Roles; shown for
                every currently assigned branch so the flags can be prepared ahead
                of that switch. can_view defaults true, can_delete false server-side
                (measured migration), never assumed here — every value comes from
                the loaded row. */}
            {!branchesLoading && !branchesError && branches.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <Caption as="p" style={{ marginBottom: 6 }}>{t('branches.flags.hint')}</Caption>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                  <span />
                  <Caption style={{ textAlign: 'center' }}>{t('branches.flags.view')}</Caption>
                  <Caption style={{ textAlign: 'center' }}>{t('branches.flags.update')}</Caption>
                  <Caption style={{ textAlign: 'center' }}>{t('branches.flags.delete')}</Caption>
                </div>
                {branches.map(b => (
                  <div key={b.location_id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center', padding: '4px 0' }}>
                    <BodyText as="span">{b.name ?? '—'}</BodyText>
                    <Toggle checked={b.can_view ?? true} disabled={branchesSaving}
                      onChange={v => setBranchFlag(b.location_id, 'can_view', v)}
                      ariaLabel={t('branches.flags.viewFor', { name: b.name ?? '' })} />
                    <Toggle checked={b.can_update ?? true} disabled={branchesSaving}
                      onChange={v => setBranchFlag(b.location_id, 'can_update', v)}
                      ariaLabel={t('branches.flags.updateFor', { name: b.name ?? '' })} />
                    <Toggle checked={b.can_delete ?? false} disabled={branchesSaving}
                      onChange={v => setBranchFlag(b.location_id, 'can_delete', v)}
                      ariaLabel={t('branches.flags.deleteFor', { name: b.name ?? '' })} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optional password reset */}
          <div style={{ marginBottom: changePassword ? 12 : 20 }}>
            <FieldRow label={t('changePassword')}>
              <CheckboxField checked={changePassword} onChange={setChangePassword} />
            </FieldRow>
          </div>
          {changePassword && (
            <div style={{ marginBottom: 20 }}>
              <FieldRow label={t('newPassword')} required>
                <TextField type="password" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder={t('pwPlaceholder')} />
              </FieldRow>
            </div>
          )}

          {/* CredentialChangeGuard: self-edit touching email/password needs the
              account's own current password re-entered before the server accepts it. */}
          {credentialChange && (
            <div style={{ marginBottom: 20 }}>
              <FieldRow label={t('currentPassword')} required>
                <TextField type="password" value={form.currentPassword} onChange={set('currentPassword')} autoComplete="current-password" />
              </FieldRow>
              <Caption as="p" style={{ marginTop: 5 }}>{t('currentPasswordHint')}</Caption>
            </div>
          )}

          {error && <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" variant="primary"
              disabled={saving || hasFormatError || (credentialChange && form.currentPassword === '')}>
              {saving ? <><Spinner size={13} /> {t('saving')}</> : t('common:save')}
            </Button>
          </div>
        </form>
    </FloatingPanel>
  )
}
