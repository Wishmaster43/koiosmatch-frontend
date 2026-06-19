/**
 * ProfilePage — the logged-in user's own profile + preferences.
 * Tabbed (Profiel / Weergave / WhatsApp Web) to match the settings area. The
 * header avatar is uploadable. Saves changes back to the API and refreshes the user.
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation }      from 'react-i18next'
import { User, Mail, Phone, Sun, Moon, Globe, Check, Loader2, Camera, MessageCircle, MapPin, Shield } from 'lucide-react'
import { useAuth }            from '../../context/AuthContext'
import { useTheme }           from '../../context/ThemeContext'
import api                    from '../../lib/api'
import { PAGE_SIZE_OPTIONS }  from '../../components/ui/PaginationBar'
import Avatar                 from '../../components/ui/Avatar'
import ProfileWhatsAppWeb     from './ProfileWhatsAppWeb'
import ProfileEmailConnect    from './ProfileEmailConnect'

const LANGUAGES = [
  { value: 'nl', label: 'Nederlands',  flag: '🇳🇱' },
  { value: 'en', label: 'English',     flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch',     flag: '🇩🇪' },
  { value: 'fr', label: 'Français',    flag: '🇫🇷' },
  { value: 'es', label: 'Español',     flag: '🇪🇸' },
]

// Role → colour (mirrors UsersPage). Label comes from the `users` i18n namespace.
const ROLE_META = {
  super_admin:  { color: '#7C3AED', bg: '#F5F3FF' },
  tenant_admin: { color: '#1D4ED8', bg: 'var(--color-secondary-bg)' },
  admin:        { color: '#1D4ED8', bg: 'var(--color-secondary-bg)' },
  planner:      { color: '#065F46', bg: '#ECFDF5' },
  default:      { color: '#6B7280', bg: '#F3F4F6' },
}

function Pill({ label, color = '#6B7280', bg = '#F3F4F6', icon: Icon }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color,
                   border: `1px solid ${color}22`, borderRadius: 999, padding: '3px 10px',
                   fontSize: 12, fontWeight: 500 }}>
      {Icon && <Icon size={11} />}{label}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 24, marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
                   letterSpacing: '0.05em', marginBottom: 18 }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  background: 'var(--input-bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
  transition: 'border-color 0.15s',
}

// Underline tab strip — same visual language as the settings area.
function ProfileTabs({ tabs, active, onSelect }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
                                 marginBottom: 24, overflowX: 'auto' }}>
      {tabs.map(tb => {
        const Icon = tb.icon
        const isActive = tb.id === active
        return (
          <button key={tb.id} role="tab" aria-selected={isActive} onClick={() => onSelect(tb.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: 'none',
              background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.12s',
            }}>
            {Icon && <Icon size={14} />}
            {tb.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation('auth')
  const { t: tUsers } = useTranslation('users')
  const { user, refreshUser } = useAuth()
  const { theme, setTheme, language, setLanguage } = useTheme()

  const [tab,      setTab]      = useState('profile')
  const [form, setForm] = useState({
    firstname: '', lastname: '', email: '', phone: '',
  })
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState(null)
  const [langOpen, setLangOpen] = useState(false)

  // Avatar upload — instant local preview, then persist (mirrors the logo upload).
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarBusy,    setAvatarBusy]    = useState(false)
  const fileRef = useRef(null)

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

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      await api.put('/auth/me', form)
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('profile.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const photo = avatarPreview ?? user?.avatar_url ?? null

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))   // show immediately
    setAvatarBusy(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      const res = await api.post('/auth/me/avatar', fd)
      if (res.data?.avatar_url) { setAvatarPreview(null); await refreshUser() }
    } catch { /* backend may not exist yet — keep the local preview */ }
    finally { setAvatarBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const removeAvatar = async () => {
    setAvatarBusy(true)
    try { await api.delete('/auth/me/avatar'); await refreshUser() } catch { /* noop */ }
    setAvatarPreview(null); setAvatarBusy(false)
  }

  const initials = [form.firstname, form.lastname]
    .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'

  const currentLang = LANGUAGES.find(l => l.value === language) ?? LANGUAGES[0]

  // Read-only access info from /auth/me. Roles + (one or more) linked locations.
  const roles     = user?.roles ?? []
  const locations = user?.locations ?? (user?.location ? [user.location] : [])
  const roleName  = (r) => typeof r === 'string' ? r : (r?.name ?? 'default')
  const locName   = (l) => typeof l === 'string' ? l : (l?.name ?? l?.label ?? '—')

  const tabs = [
    { id: 'profile',  label: t('profile.tabs.profile'), icon: User },
    { id: 'email',    label: t('profile.tabs.email'),   icon: Mail },
    { id: 'display',  label: t('profile.tabs.display'), icon: Sun },
    { id: 'whatsapp', label: t('profile.whatsappWeb.title'), icon: MessageCircle },
  ]

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '32px 24px' }}>

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
              onMouseEnter={e => { if (!avatarBusy) e.currentTarget.style.opacity = 1 }}
              onMouseLeave={e => { if (!avatarBusy) e.currentTarget.style.opacity = 0 }}>
              {avatarBusy
                ? <Loader2 size={18} color="white" style={{ animation: 'spin 1s linear infinite' }} />
                : <Camera size={18} color="white" />}
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickAvatar} />
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

      {/* ── Profiel ── */}
      {tab === 'profile' && (
        <Section title={t('profile.personalInfo')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={t('profile.firstName')}>
              <div style={{ position: 'relative' }}>
                <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={form.firstname} onChange={set('firstname')}
                  style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('profile.firstName')} />
              </div>
            </Field>
            <Field label={t('profile.lastName')}>
              <input value={form.lastname} onChange={set('lastname')}
                style={inputStyle} placeholder={t('profile.lastName')} />
            </Field>
          </div>
          <Field label={t('profile.email')}>
            <div style={{ position: 'relative' }}>
              <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={form.email} onChange={set('email')} type="email"
                style={{ ...inputStyle, paddingLeft: 30 }} placeholder={t('profile.emailPlaceholder')} />
            </div>
          </Field>
          <Field label={t('profile.phone')}>
            <div style={{ position: 'relative' }}>
              <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={form.phone} onChange={set('phone')} type="tel"
                style={{ ...inputStyle, paddingLeft: 30 }} placeholder="+31 6 12345678" />
            </div>
          </Field>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{error}</p>
          )}

          <button onClick={handleSave} disabled={saving}
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
      )}

      {/* ── Toegang: gekoppelde rollen + locatie(s) (read-only) ── */}
      {tab === 'profile' && (
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
      )}

      {/* ── E-mail (persoonlijk) ── */}
      {tab === 'email' && (
        <Section title={t('profile.email.title')}>
          <ProfileEmailConnect />
        </Section>
      )}

      {/* ── Weergave ── */}
      {tab === 'display' && (
        <Section title={t('profile.display')}>
          <Field label={t('profile.defaultPageSize')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PAGE_SIZE_OPTIONS.map(n => {
                const active = (form.default_per_page ?? 500) === n
                return (
                  <button key={n}
                    onClick={() => setForm(f => ({ ...f, default_per_page: n }))}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                      background: active ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                      color: active ? 'var(--color-primary)' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                    {n}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              {t('profile.pageSizeHint')}
            </p>
          </Field>

          <Field label={t('profile.theme')}>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: 'light', icon: <Sun size={14} />,  label: t('profile.light') },
                { value: 'dark',  icon: <Moon size={14} />, label: t('profile.dark') },
              ].map(opt => (
                <button key={opt.value} onClick={() => setTheme(opt.value)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: `1.5px solid ${theme === opt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: theme === opt.value ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                    color: theme === opt.value ? 'var(--color-primary)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('profile.language')}>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setLangOpen(o => !o)}
                style={{
                  ...inputStyle, display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{currentLang.flag} {currentLang.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>▾</span>
              </button>
              {langOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden',
                }}>
                  {LANGUAGES.map(lang => (
                    <button key={lang.value}
                      onClick={() => { setLanguage(lang.value); setLangOpen(false) }}
                      style={{
                        width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left',
                        background: language === lang.value ? 'var(--color-primary-bg)' : 'transparent',
                        color: language === lang.value ? 'var(--color-primary)' : 'var(--text)',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => { if (language !== lang.value) e.currentTarget.style.background = 'var(--hover-bg)' }}
                      onMouseLeave={e => { if (language !== lang.value) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                      {language === lang.value && <Check size={12} style={{ marginLeft: 'auto' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </Section>
      )}

      {/* ── WhatsApp Web ── */}
      {tab === 'whatsapp' && (
        <Section title={t('profile.whatsappWeb.title')}>
          <ProfileWhatsAppWeb />
        </Section>
      )}
    </div>
  )
}
