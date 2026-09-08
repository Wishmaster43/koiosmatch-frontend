/**
 * ProfileDetailsTab — the "Profiel" tab: the editable personal-info form
 * (name / email / phone + save) and a read-only access card showing the user's
 * roles and linked location(s), plus the user's default branch preference picker.
 * State lives in ProfilePage; this renders it.
 */
import type { ChangeEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Phone, Check, Shield, MapPin } from 'lucide-react'
import { Section, Field, Pill, ROLE_META, inputStyle } from './profileParts'
import { Caption } from '@/components/ui/typography'
import Spinner from '@/components/ui/Spinner'
import SaveButton from '@/components/ui/SaveButton'
import SelectMenu from '@/components/ui/SelectMenu'
import { useProfileBranches } from './useProfileBranches'

interface ProfileForm { firstname: string; lastname: string; email: string; phone: string }
interface ProfileUser { roles?: Array<string | { name?: string }>; locations?: unknown[]; location?: unknown }

interface ProfileDetailsTabProps {
  form: ProfileForm
  onField: (field: keyof ProfileForm) => (e: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  saving?: boolean
  saved?: boolean
  error?: ReactNode
  user?: ProfileUser | null
  // CredentialChangeGuard (CMBE bundle B): re-entering the current password is
  // required only once the e-mail actually changed (or the server flagged a
  // stale diff via a 403) — mirrors EditUserModal's self-edit guard.
  credentialChange?: boolean
  currentPassword?: string
  onCurrentPasswordChange?: (e: ChangeEvent<HTMLInputElement>) => void
}

// The editable personal-info form plus a read-only roles/locations access card + default branch picker.
export default function ProfileDetailsTab({ form, onField, onSave, saving, saved, error, user,
  credentialChange, currentPassword, onCurrentPasswordChange }: ProfileDetailsTabProps) {
  const { t } = useTranslation('auth')
  const { t: tUsers } = useTranslation('users')

  // Load the user's linked branches + set default preference (X-13).
  const { branches, defaultBranchId, loading: branchesLoading, setDefault } = useProfileBranches()

  // Read-only access info from /auth/me — roles + (one or more) linked locations.
  const roles     = user?.roles ?? []
  const locations = user?.locations ?? (user?.location ? [user.location] : [])
  const roleName  = (r: string | { name?: string }) => typeof r === 'string' ? r : (r?.name ?? 'default')
  const locName   = (l: unknown) => typeof l === 'string' ? l : ((l as { name?: string; label?: string })?.name ?? (l as { label?: string })?.label ?? '—')

  return (
    <>
      {/* Personal info form */}
      <Section title={t('profile.personalInfo')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={t('profile.firstName')}>
            <div style={{ position: 'relative' }}>
              <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={form.firstname} onChange={onField('firstname')}
                style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('profile.firstName')} aria-label={t('profile.firstName')} />
            </div>
          </Field>
          <Field label={t('profile.lastName')}>
            <input value={form.lastname} onChange={onField('lastname')}
              style={inputStyle} placeholder={t('profile.lastName')} aria-label={t('profile.lastName')} />
          </Field>
        </div>
        <Field label={t('profile.emailLabel')}>
          <div style={{ position: 'relative' }}>
            <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={form.email} onChange={onField('email')} type="email"
              style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('profile.emailPlaceholder')} aria-label={t('profile.emailLabel')} />
          </div>
        </Field>
        <Field label={t('profile.phone')}>
          <div style={{ position: 'relative' }}>
            <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={form.phone} onChange={onField('phone')} type="tel"
              style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('common:placeholders.phoneExample')} aria-label={t('profile.phone')} />
          </div>
        </Field>

        {/* CredentialChangeGuard: appears only once an e-mail change (or a
            server-flagged stale diff) requires re-entering the current password. */}
        {credentialChange && (
          <Field label={t('profile.currentPassword')} htmlFor="current-password">
            <input id="current-password" type="password" required value={currentPassword ?? ''}
              onChange={onCurrentPasswordChange} style={inputStyle} autoComplete="current-password"
              aria-label={t('profile.currentPassword')} />
            <Caption as="p" style={{ marginTop: 5 }}>{t('profile.currentPasswordHint')}</Caption>
          </Field>
        )}

        {error && (
          <p style={{ fontSize: 12, color: 'var(--color-danger-text)', marginTop: 4 }}>{error}</p>
        )}

        {/* The saved-state pair is defined ONCE in SaveButton (§4) — never re-approximated.
            CredentialChangeGuard: blocked until the current password is filled in. */}
        <SaveButton saved={saved} onClick={onSave}
          disabled={saving || (!!credentialChange && !currentPassword)} style={{ marginTop: 8, gap: 6 }}>
          {saving
            ? <><Spinner size={13} /> {t('profile.saving')}</>
            : saved
              ? <><Check size={13} /> {t('profile.saved')}</>
              : t('profile.saveChanges')}
        </SaveButton>
      </Section>

      {/* Access: linked roles + location(s) (read-only) + default branch preference (X-13) */}
      <Section title={t('profile.access')}>
        <Field label={t('profile.roles')}>
          {roles.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {roles.map((r, i) => {
                const name = roleName(r)
                const meta = ROLE_META[name] ?? ROLE_META.default
                return <Pill key={i} icon={Shield} color={meta.color} bg={meta.bg}
                  label={tUsers(`roles.${name === 'default' ? 'user' : name}`, { defaultValue: name })} />
              })}
            </div>
          ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('profile.noRoles')}</span>}
        </Field>
        <Field label={t('profile.locations')}>
          {locations.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {locations.map((l, i) => <Pill key={i} icon={MapPin} label={locName(l)} />)}
            </div>
          ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('profile.noLocations')}</span>}
        </Field>

        {/* Default branch preference (X-13) — user-facing option within their own couplings. */}
        <Field label={t('profile.defaultBranch')}>
          {branchesLoading ? (
            <Caption as="div"><Spinner size={12} /> {t('profile.loading')}</Caption>
          ) : branches.length === 0 ? (
            // An unrestricted user (no couplings) cannot pick a default here — honest notice, no picker (§3).
            <Caption as="div">{t('profile.noBranchCouplings')}</Caption>
          ) : (
            <>
              <SelectMenu
                options={branches.map(b => ({ value: b.location_id, label: b.name ?? '—' }))}
                value={defaultBranchId ?? ''}
                onChange={(v) => setDefault(v || null)}
                placeholder={t('profile.defaultBranch')}
               
                clearable
                clearLabel={t('common:clear')}
              />
              <Caption as="p" style={{ marginTop: 5 }}>{t('profile.defaultBranchHint')}</Caption>
            </>
          )}
        </Field>
      </Section>
    </>
  )
}
