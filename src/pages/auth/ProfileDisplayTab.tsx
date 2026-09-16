/**
 * ProfileDisplayTab — the "Weergave" tab: default table page size, light/dark
 * theme toggle, the UI language picker, and the Koios AI mode (Wizard/Auto).
 * Owns only its own dropdown-open state; the display values persist via
 * ProfilePage / ThemeContext, the Koios mode via its own hook (own GET/PUT
 * resource, K0 contract — separate from the /auth/me profile PUT).
 */
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Globe } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '@/components/ui/PaginationBar'
import { Section, Field, LANGUAGES } from './profileParts'
import type { ProfileFormData } from './profileParts'
import { useMyKoiosMode } from './useMyKoiosMode'
import type { KoiosMode } from './useMyKoiosMode'
import { Caption } from '@/components/ui/typography'
import { tintBg, tintBorder, chipInk } from '@/lib/tint'
import SelectMenu from '@/components/ui/SelectMenu'
import Toggle from '@/components/ui/Toggle'
import CalloutBox from '@/components/ui/CalloutBox'

interface ProfileDisplayTabProps {
  form: ProfileFormData
  setForm: Dispatch<SetStateAction<ProfileFormData>>
  // Persists a picked page size right away (X-15): this tab has no Save button.
  onPickPageSize?: (n: number) => void
  theme: string
  setTheme: (theme: string) => void
  language: string
  setLanguage: (lang: string) => void
}

// CHIP-TINT-1: the one active/inactive style for a choice-chip button — 16/50 tint,
// chipInk text, 600 weight when selected, never the old hand-painted 1.5px accent border.
function choiceChipStyle(active: boolean): CSSProperties {
  return {
    borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
    border: active ? tintBorder('var(--color-primary)', true) : '1.5px solid var(--border)',
    // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- tintBg/tintBorder ARE the canonical §4 tint helpers; the primary token here is only their argument, not a hand-painted fill
    background: active ? tintBg('var(--color-primary)', true) : 'var(--input-bg)',
    color: active ? chipInk('var(--color-primary)') : 'var(--text-muted)',
    transition: 'all 0.15s',
  }
}

// Display preferences tab (see the module doc above): everything round-trips through the caller/hooks that actually persist it.
export default function ProfileDisplayTab({ form, setForm, onPickPageSize, theme, setTheme, language, setLanguage }: ProfileDisplayTabProps) {
  const { t } = useTranslation('auth')
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
                onClick={() => { setForm(f => ({ ...f, default_per_page: n })); onPickPageSize?.(n) }}
                // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- §4 soft-tint multi-option toggle pill (selected/unselected identity Button's variants don't express), not a Button copy
                style={{ ...choiceChipStyle(active), padding: '7px 16px' }}>
                {n}
              </button>
            )
          })}
        </div>
        <Caption as="p" style={{ marginTop: 6 }}>
          {t('profile.pageSizeHint')}
        </Caption>
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
              style={{ ...choiceChipStyle(theme === opt.value), flex: 1, padding: '10px 0',
                       display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Language — the shared searchable SelectMenu (ALTIJD een zoekbare dropdown + DROPDOWN-CLEAR-1). */}
      <Field label={t('profile.language')}>
        <SelectMenu
          leading={<Globe size={13} style={{ color: 'var(--text-muted)' }} />}
          options={LANGUAGES.map(l => ({ value: l.value, label: `${l.flag} ${langLabel(l.value)}` }))}
          value={language}
          onChange={v => { if (v) setLanguage(v) }}
          clearable={false}
          // DROPDOWN-CLEAR-1: the UI language is always set (never "no language"), so clearing would leave an invalid, unrenderable state.
        />
      </Field>
    </Section>

    {/* Koios AI mode — Wizard (confirm every action) vs Auto (act immediately);
        auto_messages only makes sense once Auto is picked (§0 no fake affordances:
        disable rather than hide, so the relationship stays visible). */}
    <Section title={t('profile.koiosMode.title')}>
      <Caption as="p" style={{ marginTop: -10, marginBottom: 18 }}>
        {t('profile.koiosMode.desc')}
      </Caption>

      {koios.loading && <Caption as="p">{t('profile.koiosMode.loading')}</Caption>}

      {/* A failed load never shows an editor seeded with the hard-coded default as
          if it were the user's saved setting (§0 four UI states) — real error surface + retry. */}
      {!koios.loading && koios.error && (
        <CalloutBox variant="danger">{t('profile.koiosMode.loadError')}</CalloutBox>
      )}

      {!koios.loading && !koios.error && (
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
                  style={{ ...choiceChipStyle(koios.mode === opt.value), flex: 1, padding: '10px 0',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {opt.label}
                  {/* KOIOS-MODE-DEFAULT: unset user choice -> this pill's value came from the bureau default. */}
                  {koios.isBureauDefault && koios.mode === opt.value && (
                    <Caption as="span" style={{ marginLeft: 4 }}>{t('profile.koiosMode.bureauDefault')}</Caption>
                  )}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('profile.koiosMode.autoMessages')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                          opacity: koios.mode === 'auto' ? 1 : 0.5 }}>
              <Toggle checked={koios.autoMessages} disabled={koios.mode !== 'auto'}
                onChange={koios.setAutoMessages} ariaLabel={t('profile.koiosMode.autoMessages')} />
              <Caption as="span">{t('profile.koiosMode.autoMessagesHint')}</Caption>
            </div>
          </Field>
        </>
      )}
    </Section>
    </>
  )
}
