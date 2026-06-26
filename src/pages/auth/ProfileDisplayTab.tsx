/**
 * ProfileDisplayTab — the "Weergave" tab: default table page size, light/dark
 * theme toggle and the UI language picker. Owns only its own dropdown-open
 * state; the persisted values live in ProfilePage / ThemeContext.
 */
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Globe, Check } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '../../components/ui/PaginationBar'
import { Section, Field, inputStyle, LANGUAGES } from './profileParts'
import type { ProfileFormData } from './profileParts'

interface ProfileDisplayTabProps {
  form: ProfileFormData
  setForm: Dispatch<SetStateAction<ProfileFormData>>
  theme: string
  setTheme: (theme: string) => void
  language: string
  setLanguage: (lang: string) => void
}

export default function ProfileDisplayTab({ form, setForm, theme, setTheme, language, setLanguage }: ProfileDisplayTabProps) {
  const { t } = useTranslation('auth')
  const [langOpen, setLangOpen] = useState(false)
  const currentLang = LANGUAGES.find(l => l.value === language) ?? LANGUAGES[0]

  return (
    <Section title={t('profile.display')}>
      {/* Default table page size */}
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

      {/* Theme */}
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

      {/* Language */}
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
  )
}
