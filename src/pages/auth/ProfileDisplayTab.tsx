/**
 * ProfileDisplayTab — the "Weergave" tab: default table page size, light/dark
 * theme toggle, the UI language picker, and the Koios AI mode (Wizard/Auto).
 * Owns only its own dropdown-open state; the display values persist via
 * ProfilePage / ThemeContext, the Koios mode via its own hook (own GET/PUT
 * resource, K0 contract — separate from the /auth/me profile PUT).
 */
import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Globe, Check } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '@/components/ui/PaginationBar'
import { Section, Field, inputStyle, LANGUAGES } from './profileParts'
import type { ProfileFormData } from './profileParts'
import { useMyKoiosMode } from './useMyKoiosMode'
import type { KoiosMode } from './useMyKoiosMode'

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
  // Autonym lookup — each language names itself (see profileParts.LANGUAGES comment).
  const langLabel = (code: string) => t(`languageNames.${code}`)

  // Koios AI mode (K0) — own GET/PUT resource, loaded + saved by its own hook.
  const koios = useMyKoiosMode()

  return (
    <>
    <Section title={t('profile.display')}>
      {/* Default table page size */}
      <Field label={t('profile.defaultPageSize')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PAGE_SIZE_OPTIONS.map(n => {
            // Unset preference highlights the CANONICAL list fallback (50) — every
            // list page seeds 50 when nothing is saved, so the pill must agree.
            const active = (form.default_per_page ?? 50) === n
            return (
              <button key={n}
                onClick={() => setForm(f => ({ ...f, default_per_page: n }))}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- §4 soft-tint multi-option toggle pill (selected/unselected identity Button's variants don't express), not a Button copy
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--border)'}`,
                  background: active ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                  // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                  color: active ? 'var(--color-primary-text)' : 'var(--text-muted)',
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
              // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- §4 soft-tint multi-option toggle pill (selected/unselected identity Button's variants don't express), not a Button copy
              style={{
                flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: `1.5px solid ${theme === opt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                background: theme === opt.value ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                color: theme === opt.value ? 'var(--color-primary-text)' : 'var(--text-muted)',
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
            // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dropdown trigger rendering the current field value, mirrors the house field-input chrome, not a Button
            style={{
              ...inputStyle, display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', textAlign: 'left',
            }}>
            <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{currentLang.flag} {langLabel(currentLang.value)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>▾</span>
          </button>
          {langOpen && (
            // Floating dropdown under its trigger, on a plain page (not inside a
            // drawer/dialog) — the CSS popover rung, so it beats every dialog band.
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 'var(--z-popover)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: 'var(--shadow-float)', overflow: 'hidden',
            }}>
              {LANGUAGES.map(lang => (
                <button key={lang.value}
                  onClick={() => { setLanguage(lang.value); setLangOpen(false) }}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dropdown menu-item row, not a Button
                  style={{
                    width: '100%', padding: '10px 14px', fontSize: 13, textAlign: 'left',
                    background: language === lang.value ? 'var(--color-primary-bg)' : 'transparent',
                    // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                    color: language === lang.value ? 'var(--color-primary-text)' : 'var(--text)',
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { if (language !== lang.value) e.currentTarget.style.background = 'var(--hover-bg)' }}
                  onMouseLeave={e => { if (language !== lang.value) e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{lang.flag}</span>
                  <span>{langLabel(lang.value)}</span>
                  {language === lang.value && <Check size={12} style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>
    </Section>

    {/* Koios AI mode — Wizard (confirm every action) vs Auto (act immediately);
        auto_messages only makes sense once Auto is picked (§0 no fake affordances:
        disable rather than hide, so the relationship stays visible). */}
    <Section title={t('profile.koiosMode.title')}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -10, marginBottom: 18 }}>
        {t('profile.koiosMode.desc')}
      </p>

      {koios.loading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('profile.koiosMode.loading')}</p>}
      {koios.error && <p style={{ fontSize: 13, color: 'var(--color-danger)' }}>{t('profile.koiosMode.loadError')}</p>}

      {!koios.loading && (
        <>
          <Field label={t('profile.koiosMode.title')}>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                { value: 'wizard' as KoiosMode, label: t('profile.koiosMode.wizard') },
                { value: 'auto' as KoiosMode,   label: t('profile.koiosMode.auto') },
              ]).map(opt => (
                <button key={opt.value} onClick={() => koios.setMode(opt.value)}
                  aria-pressed={koios.mode === opt.value}
                  // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- §4 soft-tint multi-option toggle pill (selected/unselected identity Button's variants don't express), not a Button copy
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    border: `1.5px solid ${koios.mode === opt.value ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: koios.mode === opt.value ? 'var(--color-primary-bg)' : 'var(--input-bg)',
                    // Text-colour accent uses the AA-contrast text token, not the raw brand primary.
                    color: koios.mode === opt.value ? 'var(--color-primary-text)' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('profile.koiosMode.autoMessages')}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                            opacity: koios.mode === 'auto' ? 1 : 0.5, cursor: koios.mode === 'auto' ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={koios.autoMessages} disabled={koios.mode !== 'auto'}
                onChange={e => koios.setAutoMessages(e.target.checked)} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('profile.koiosMode.autoMessagesHint')}</span>
            </label>
          </Field>
        </>
      )}
    </Section>
    </>
  )
}
