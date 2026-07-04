/**
 * ProfilePage — the logged-in user's own profile + preferences.
 * Thin container: owns form + avatar state, declares the tab list, and routes
 * each tab to its own component. The header avatar is uploadable. Tabs:
 * Profiel / E-mail / Weergave / WhatsApp Web / Security.
 */
import { useState } from 'react'
import { useTranslation }      from 'react-i18next'
import { User, Mail, Sun, Loader2, Camera, Shield } from 'lucide-react'
import { useTheme }           from '@/context/ThemeContext'
import Avatar                 from '@/components/ui/Avatar'
import ProfileEmailConnect    from './ProfileEmailConnect'
import SecuritySettings        from '../settings/sections/SecuritySettings'
import { Section, ProfileTabs } from './profileParts'
import ProfileDetailsTab       from './ProfileDetailsTab'
import ProfileDisplayTab       from './ProfileDisplayTab'
import { useProfileForm }      from './useProfileForm'

export default function ProfilePage() {
  const { t } = useTranslation('auth')
  const { t: tSettings } = useTranslation('settings')
  const { theme, setTheme, language, setLanguage } = useTheme()
  const [tab, setTab] = useState('profile')

  // Data layer: the profile form (synced from /auth/me), save, and avatar upload/remove.
  const { user, form, setForm, set, saving, saved, error, handleSave,
          photo, avatarBusy, fileRef, onPickAvatar, removeAvatar, initials } = useProfileForm()

  const tabs = [
    { id: 'profile',  label: t('profile.tabs.profile'), icon: User },
    { id: 'email',    label: t('profile.tabs.email'),   icon: Mail },
    { id: 'display',  label: t('profile.tabs.display'), icon: Sun },
    { id: 'security', label: tSettings('nav.security'), icon: Shield },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 32px' }}>

      {/* Avatar (uploadable) + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => fileRef.current?.click()} disabled={avatarBusy} title={t('profile.changePhoto')}
            style={{ position: 'relative', border: 'none', background: 'none', padding: 0, borderRadius: '50%',
                     cursor: avatarBusy ? 'default' : 'pointer', display: 'block' }}>
            <Avatar initials={initials} size={64} photo={photo} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: avatarBusy ? 1 : 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { if (!avatarBusy) e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { if (!avatarBusy) e.currentTarget.style.opacity = '0' }}>
              {avatarBusy
                ? <Loader2 size={18} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                : <Camera size={18} color="white" />}
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" aria-label={t('profile.uploadPhoto', { defaultValue: 'Upload photo' })} style={{ display: 'none' }} onChange={onPickAvatar} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {[form.firstname, form.lastname].filter(Boolean).join(' ') || user?.name || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{form.email}</div>
          {photo && (
            <button onClick={removeAvatar} disabled={avatarBusy}
              style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                       fontSize: 11, color: 'var(--color-danger)' }}>
              {t('profile.removePhoto')}
            </button>
          )}
        </div>
      </div>

      <ProfileTabs tabs={tabs} active={tab} onSelect={setTab} />

      {/* Each tab routes to its own component; state stays here. */}
      {tab === 'profile' && (
        <ProfileDetailsTab form={form} onField={set} onSave={handleSave}
          saving={saving} saved={saved} error={error} user={user} />
      )}

      {tab === 'email' && (
        <Section title={t('profile.email.title')}>
          <ProfileEmailConnect />
        </Section>
      )}

      {tab === 'display' && (
        <ProfileDisplayTab form={form} setForm={setForm}
          theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} />
      )}

      {tab === 'security' && (
        <Section title={tSettings('nav.security')}>
          <SecuritySettings />
        </Section>
      )}
    </div>
  )
}
