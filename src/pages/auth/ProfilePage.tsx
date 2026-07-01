/**
 * ProfilePage — the logged-in user's own profile + preferences.
 * Thin container: owns form + avatar state, declares the tab list, and routes
 * each tab to its own component. The header avatar is uploadable. Tabs:
 * Profiel / E-mail / Weergave / WhatsApp Web / Security.
 */
import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useTranslation }      from 'react-i18next'
import { User, Mail, Sun, Loader2, Camera, MessageCircle, Shield } from 'lucide-react'
import { useAuth }            from '@/context/AuthContext'
import { useTheme }           from '@/context/ThemeContext'
import api                    from '@/lib/api'
import Avatar                 from '@/components/ui/Avatar'
import ProfileWhatsAppWeb     from './ProfileWhatsAppWeb'
import ProfileEmailConnect    from './ProfileEmailConnect'
import SecuritySettings        from '../settings/sections/SecuritySettings'
import { Section, ProfileTabs } from './profileParts'
import type { ProfileFormData } from './profileParts'
import ProfileDetailsTab       from './ProfileDetailsTab'
import ProfileDisplayTab       from './ProfileDisplayTab'

export default function ProfilePage() {
  const { t } = useTranslation('auth')
  const { t: tSettings } = useTranslation('settings')
  const { user, refreshUser } = useAuth() ?? {}
  const { theme, setTheme, language, setLanguage } = useTheme()

  const [tab,    setTab]    = useState('profile')
  const [form, setForm] = useState<ProfileFormData>({
    firstname: '', lastname: '', email: '', phone: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  // Avatar upload — instant local preview, then persist (mirrors the logo upload).
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarBusy,    setAvatarBusy]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sync as soon as the user arrives from /auth/me (may be after mount).
  useEffect(() => {
    if (!user) return
    setForm({
      firstname:        user.firstname        ?? '',
      lastname:         user.lastname         ?? '',
      email:            user.email            ?? '',
      phone:            user.phone            ?? '',
      default_per_page: user.default_per_page ?? 500,
    })
  }, [user?.id, user?.firstname, user?.lastname, user?.email, user?.phone, user?.default_per_page])

  // Build a change handler for a single text field.
  const set = (k: keyof ProfileFormData) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // Persist profile fields, then refresh the cached user.
  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await api.put('/auth/me', form)
      await refreshUser?.()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('profile.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const photo = avatarPreview ?? user?.avatar_url ?? null

  // Upload a new avatar — optimistic preview, persist, then refresh on success.
  const onPickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))   // show immediately
    setAvatarBusy(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.post('/auth/me/avatar', fd)
      if (res.data?.avatar_url) { setAvatarPreview(null); await refreshUser?.() }
    } catch { /* backend may not exist yet — keep the local preview */ }
    finally { setAvatarBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // Remove the stored avatar and fall back to initials.
  const removeAvatar = async () => {
    setAvatarBusy(true)
    try { await api.delete('/auth/me/avatar'); await refreshUser?.() } catch { /* noop */ }
    setAvatarPreview(null); setAvatarBusy(false)
  }

  const initials = [form.firstname, form.lastname]
    .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'

  const tabs = [
    { id: 'profile',  label: t('profile.tabs.profile'), icon: User },
    { id: 'email',    label: t('profile.tabs.email'),   icon: Mail },
    { id: 'display',  label: t('profile.tabs.display'), icon: Sun },
    { id: 'whatsapp', label: t('profile.whatsappWeb.title'), icon: MessageCircle },
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

      {tab === 'whatsapp' && (
        <Section title={t('profile.whatsappWeb.title')}>
          <ProfileWhatsAppWeb />
        </Section>
      )}

      {tab === 'security' && (
        <Section title={tSettings('nav.security')}>
          <SecuritySettings />
        </Section>
      )}
    </div>
  )
}
