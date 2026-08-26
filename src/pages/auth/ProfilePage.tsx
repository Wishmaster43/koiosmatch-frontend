/**
 * ProfilePage — the logged-in user's own profile + preferences.
 * Thin container: owns form + avatar state, declares the tab list, and routes
 * each tab to its own component. The header avatar is uploadable. Tabs:
 * Profile / Email / Display / WhatsApp Web / Security.
 */
import { useState } from 'react'
import { useTranslation }      from 'react-i18next'
import { User, Mail, Sun, Camera, Shield, MessageCircle } from 'lucide-react'
import { useTheme }           from '@/context/ThemeContext'
import { useAuth }            from '@/context/AuthContext'
import Avatar                 from '@/components/ui/Avatar'
import Spinner                from '@/components/ui/Spinner'
import Button                 from '@/components/ui/Button'
import ProfileEmailConnect    from './ProfileEmailConnect'
import ProfileWhatsAppWeb      from './ProfileWhatsAppWeb'
import SecuritySettings        from '../settings/sections/SecuritySettings'
import { Section, ProfileTabs } from './profileParts'
import ProfileDetailsTab       from './ProfileDetailsTab'
import ProfileDisplayTab       from './ProfileDisplayTab'
import { useProfileForm }      from './useProfileForm'

// Role/user page.whatsapp permission whitelist, mirroring the role-level check
// in src/lib/access.ts. Kept local (not the shared canAccessPage('whatsapp'))
// because that helper ALSO requires the tenant-wide WABA 'whatsapp' module,
// which is unrelated to this per-user WhatsApp Web device feature (K-193 fase
// 2b): the BE gates this route on module:whatsapp_web + permission:page.whatsapp
// only, so a tenant with whatsapp_web but no WABA must still see the tab.
function hasWhatsappWebPagePermission(auth: ReturnType<typeof useAuth>): boolean {
  if (auth?.user?.is_super_admin === true) return true
  const permsRaw = auth?.user?.permissions
  const perms: Array<string | { name?: string }> = Array.isArray(permsRaw) ? permsRaw : []
  const nameOf = (p: string | { name?: string }) => (typeof p === 'string' ? p : (p?.name ?? ''))
  const pagePerms = perms.filter((p) => nameOf(p).startsWith('page.'))
  // No page.* permissions at all -> whitelist not in use, every page is open.
  return pagePerms.length === 0 || pagePerms.some((p) => nameOf(p) === 'page.whatsapp')
}

// The profile page container: form/avatar state + tab routing.
export default function ProfilePage() {
  const { t } = useTranslation('auth')
  const { t: tSettings } = useTranslation('settings')
  const { theme, setTheme, language, setLanguage } = useTheme()
  const auth = useAuth()
  const [tab, setTab] = useState('profile')

  // Data layer: the profile form (synced from /auth/me), save, and avatar upload/remove.
  const { user, form, setForm, set, saving, saved, error, handleSave,
          photo, avatarBusy, fileRef, onPickAvatar, removeAvatar, initials } = useProfileForm()

  // K-193 fase 2b: the WhatsApp Web tab shows only when the tenant has the
  // whatsapp_web module AND the role's page.whatsapp permission allows it
  // (matches the BE route gate exactly — see hasWhatsappWebPagePermission above).
  const showWhatsAppWeb = !!auth?.hasModule('whatsapp_web') && hasWhatsappWebPagePermission(auth)

  const tabs = [
    { id: 'profile',  label: t('profile.tabs.profile'), icon: User },
    { id: 'email',    label: t('profile.tabs.email'),   icon: Mail },
    { id: 'display',  label: t('profile.tabs.display'), icon: Sun },
    ...(showWhatsAppWeb ? [{ id: 'whatsapp', label: t('profile.whatsappWeb.title'), icon: MessageCircle }] : []),
    { id: 'security', label: tSettings('nav.security'), icon: Shield },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 32px' }}>

      {/* Avatar (uploadable) + name header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => fileRef.current?.click()} disabled={avatarBusy}
            title={t('profile.changePhoto')} aria-label={t('profile.changePhoto')}
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- NECESSITY: the photo itself is the upload control (hover overlay on the avatar); Button's chrome would paint a second face around it
            style={{ position: 'relative', border: 'none', background: 'none', padding: 0, borderRadius: '50%',
                     cursor: avatarBusy ? 'default' : 'pointer', display: 'block' }}>
            <Avatar initials={initials} size={64} photo={photo} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: avatarBusy ? 1 : 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => { if (!avatarBusy) e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { if (!avatarBusy) e.currentTarget.style.opacity = '0' }}>
              {avatarBusy
                ? <span style={{ color: 'white' }}><Spinner size={18} /></span>
                : <Camera size={18} color="white" />}
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" aria-label={t('profile.uploadPhoto')} style={{ display: 'none' }} onChange={onPickAvatar} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {[form.firstname, form.lastname].filter(Boolean).join(' ') || user?.name || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{form.email}</div>
          {photo && (
            <Button variant="dangerSoft" size="sm" onClick={removeAvatar} disabled={avatarBusy} style={{ marginTop: 4 }}>
              {t('profile.removePhoto')}
            </Button>
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

      {tab === 'whatsapp' && showWhatsAppWeb && (
        <Section title={t('profile.whatsappWeb.title')}>
          <ProfileWhatsAppWeb />
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
