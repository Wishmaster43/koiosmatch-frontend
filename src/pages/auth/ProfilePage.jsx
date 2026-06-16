/**
 * ProfilePage — the logged-in user's own profile + preferences.
 * Edit name/contact details, switch theme (light/dark), pick language and
 * default page size. Saves changes back to the API and refreshes the user.
 */
import { useState, useEffect } from 'react'
import { User, Mail, Phone, Sun, Moon, Globe, Check, Loader2 } from 'lucide-react'
import { useAuth }            from '../../context/AuthContext'
import { useTheme }           from '../../context/ThemeContext'
import api                    from '../../lib/api'
import { PAGE_SIZE_OPTIONS }  from '../../components/ui/PaginationBar'

const LANGUAGES = [
  { value: 'nl', label: 'Nederlands',  flag: '🇳🇱' },
  { value: 'en', label: 'English',     flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch',     flag: '🇩🇪' },
  { value: 'fr', label: 'Français',    flag: '🇫🇷' },
  { value: 'es', label: 'Español',     flag: '🇪🇸' },
]

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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { theme, setTheme, language, setLanguage } = useTheme()

  const [form, setForm] = useState({
    firstname: '', lastname: '', email: '', phone: '',
  })
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState(null)
  const [langOpen, setLangOpen] = useState(false)

  // Sync zodra user binnenkomt vanuit /auth/me (kan later zijn dan mount)
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
      setError('Opslaan mislukt. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  const initials = [form.firstname, form.lastname]
    .filter(Boolean).map(n => n[0]).join('').toUpperCase() || '?'

  const currentLang = LANGUAGES.find(l => l.value === language) ?? LANGUAGES[0]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>


      {/* Avatar + naam header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-primary)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700,
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {[form.firstname, form.lastname].filter(Boolean).join(' ') || user?.name || '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{form.email}</div>
        </div>
      </div>

      {/* Persoonsgegevens */}
      <Section title="Persoonsgegevens">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Voornaam">
            <div style={{ position: 'relative' }}>
              <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={form.firstname} onChange={set('firstname')}
                style={{ ...inputStyle, paddingLeft: 30 }} placeholder="Voornaam" />
            </div>
          </Field>
          <Field label="Achternaam">
            <input value={form.lastname} onChange={set('lastname')}
              style={inputStyle} placeholder="Achternaam" />
          </Field>
        </div>
        <Field label="E-mailadres">
          <div style={{ position: 'relative' }}>
            <Mail size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={form.email} onChange={set('email')} type="email"
              style={{ ...inputStyle, paddingLeft: 30 }} placeholder="naam@voorbeeld.nl" />
          </div>
        </Field>
        <Field label="Telefoonnummer">
          <div style={{ position: 'relative' }}>
            <Phone size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={form.phone} onChange={set('phone')} type="tel"
              style={{ ...inputStyle, paddingLeft: 30 }} placeholder="+31 6 12345678" />
          </div>
        </Field>

        {error && (
          <p style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{error}</p>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{
            marginTop: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600,
            background: saved ? '#16A34A' : 'var(--color-primary)',
            color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.2s',
          }}>
          {saving
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Opslaan…</>
            : saved
              ? <><Check size={13} /> Opgeslagen</>
              : 'Wijzigingen opslaan'}
        </button>
      </Section>

      {/* Weergave */}
      <Section title="Weergave">
        <Field label="Standaard rijen per pagina">
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
            Geldt voor alle tabellen. Sla op via "Wijzigingen opslaan" hierboven.
          </p>
        </Field>

        <Field label="Thema">
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: 'light', icon: <Sun size={14} />,  label: 'Licht' },
              { value: 'dark',  icon: <Moon size={14} />, label: 'Donker' },
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

        <Field label="Taal">
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
    </div>
  )
}
