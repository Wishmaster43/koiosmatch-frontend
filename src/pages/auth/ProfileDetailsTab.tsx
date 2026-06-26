/**
 * ProfileDetailsTab — the "Profiel" tab: the editable personal-info form
 * (name / email / phone + save) and a read-only access card showing the user's
 * roles and linked location(s). State lives in ProfilePage; this renders it.
 */
import type { ChangeEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Phone, Check, Loader2, Shield, MapPin } from 'lucide-react'
import { Section, Field, Pill, ROLE_META, inputStyle } from './profileParts'

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
}

export default function ProfileDetailsTab({ form, onField, onSave, saving, saved, error, user }: ProfileDetailsTabProps) {
  const { t } = useTranslation('auth')
  const { t: tUsers } = useTranslation('users')

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
                style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('profile.firstName')} />
            </div>
          </Field>
          <Field label={t('profile.lastName')}>
            <input value={form.lastname} onChange={onField('lastname')}
              style={inputStyle} placeholder={t('profile.lastName')} />
          </Field>
        </div>
        <Field label={t('profile.email')}>
          <div style={{ position: 'relative' }}>
            <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={form.email} onChange={onField('email')} type="email"
              style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('profile.emailPlaceholder')} />
          </div>
        </Field>
        <Field label={t('profile.phone')}>
          <div style={{ position: 'relative' }}>
            <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={form.phone} onChange={onField('phone')} type="tel"
              style={{ ...inputStyle, paddingLeft: 30 }} placeholder="+31 6 12345678" />
          </div>
        </Field>

        {error && (
          <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{error}</p>
        )}

        <button onClick={onSave} disabled={saving}
          style={{
            marginTop: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600,
            background: saved ? 'var(--color-success)' : 'var(--color-primary)',
            color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s',
          }}>
          {saving
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> {t('profile.saving')}</>
            : saved
              ? <><Check size={13} /> {t('profile.saved')}</>
              : t('profile.saveChanges')}
        </button>
      </Section>

      {/* Access: linked roles + location(s) (read-only) */}
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
      </Section>
    </>
  )
}
