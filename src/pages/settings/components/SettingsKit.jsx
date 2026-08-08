/**
 * SettingsKit — the shared building blocks every settings section composes from.
 * Before this, each section re-implemented its own header, save button (with the
 * save/saving/saved states), card and row styling inline. Now a section is just
 * content: wrap it in <SettingsScaffold> and drop <SettingRow>s inside.
 *
 * Theme colours come from CSS variables (--color-primary etc.) so white-label
 * branding flows through automatically.
 *
 * Exports:
 *   SettingsScaffold  — title/subtitle + dirty-aware save button + skeleton
 *   SettingCard       — the white bordered card
 *   SettingRow        — label/description left, control right
 *   Toggle            — pill switch
 *   NumberField / TextField / TextareaField / SelectField / ColorField
 *   StatusBadge       — inline "active / not connected" pill
 *   SkeletonRows      — loading placeholder
 *   SettingsDirtyContext — lets the shell warn before leaving an unsaved section
 */
import { useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, RefreshCw, Save } from 'lucide-react'
import { SettingsDirtyContext } from '../lib/settingsDirty'
import ToggleUi from '@/components/ui/Toggle'
import SearchSelect from '@/components/ui/SearchSelect'
// PRE-EXISTING BUG FIX (found while verifying this task, unrelated to SUB-TABS-1/
// TENANT-DEFAULT-1 itself): ColorField's palette-swatch rebuild (Danny 02-08) called
// <ColorSwatch> without ever importing it, so EVERY `type: 'color'` schema field threw
// on mount — including the pre-existing customerDisplay chip-colour fields, which
// broke this task's own verification run. One-line fix: import the sibling component.
import { ColorSwatch } from './SettingsControls'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

const CARD = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
}

export function SettingsScaffold({ title, subtitle, form, maxWidth, actions, children }) {
  const { t } = useTranslation('settings')
  const dirtyCtx = useContext(SettingsDirtyContext)
  const { dirty = false, saving = false, saved = false, loading = false, loadError = false, save } = form ?? {}

  // Report dirtiness up to the shell so it can guard navigation; clear on unmount.
  useEffect(() => {
    dirtyCtx?.report(dirty)
    return () => dirtyCtx?.report(false)
  }, [dirty, dirtyCtx])

  // A failed load blocks Save on every useSettingsForm consumer (RetentionSettings,
  // NotificationsSettings, MemorySettings, SchemaSection, …) — writing the dirty
  // draft would overwrite an unknown tenant policy with hardcoded defaults.
  const canSave = dirty && !saving && !loadError
  return (
    <div style={{ maxWidth }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 20, gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
          {actions}
          {save && (
            <button onClick={save} disabled={!canSave}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
                fontSize: 13, fontWeight: 500, borderRadius: 8, border: 'none',
                cursor: canSave ? 'pointer' : 'default', opacity: canSave || saved ? 1 : 0.55,
                background: saved ? 'var(--color-success)' : 'var(--color-primary)',
                // Success fill needs its own on-* token — white only reaches ~3.3:1 there (WCAG audit 2026-08).
                color: saved ? 'var(--color-on-success)' : 'var(--color-on-accent)',
                transition: 'background 0.2s, opacity 0.2s',
              }}>
              {saved  ? <><Check size={13} /> {t('common.saved')}</>                                :
               saving ? <><RefreshCw size={13} className="animate-spin" /> {t('common.saving')}</> :
                        <><Save size={13} /> {t('common.save')}</>}
            </button>
          )}
        </div>
      </div>

      {loading ? <SkeletonRows /> : loadError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--color-danger)', fontSize: 13 }}>
          <AlertTriangle size={14} /> {t('common.loadError')}
        </div>
      ) : children}
    </div>
  )
}

export function SettingCard({ children, style }) {
  return <div style={{ ...CARD, padding: '14px 16px', ...style }}>{children}</div>
}

/** A list of cards with consistent vertical rhythm. */
export function SettingCardList({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
}

export function SettingRow({ label, description, children }) {
  return (
    <SettingCard style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{children}</div>
    </SettingCard>
  )
}

// Optional `ariaLabel`: pass it whenever the visible text sitting next to the
// switch is NOT already the button's sole accessible name (e.g. a wrapping
// <label> that also contains a longer description) — see CandidateVacancyTabSettings'
// leads-criteria rows, which had this same override on the raw checkbox they replace.
// Re-exported from `components/ui/Toggle` (the promoted shared component) so every
// existing `import { Toggle } from '.../SettingsKit'` call site keeps working unchanged.
export const Toggle = ToggleUi

// Canon field style (G33/fieldMetrics) — was its own copy at font-size 14 (every
// other field on the platform is 13; this settings kit was the one outlier).
const inputStyle = fieldInputStyle

export function NumberField({ value, onChange, min = 0, max, unit, width = 80 }) {
  return (
    <>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...inputStyle, width, textAlign: 'right', fontWeight: 600 }} />
      {unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 60 }}>{unit}</span>}
    </>
  )
}

export function TextField({ value, onChange, placeholder, width = 220 }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ ...inputStyle, width }} />
  )
}

export function TextareaField({ value, onChange, placeholder, minHeight = 220 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', minHeight, padding: 14, fontSize: 13, border: '1px solid var(--border)',
               borderRadius: 10, outline: 'none', resize: 'vertical', color: 'var(--text)',
               fontFamily: 'inherit', lineHeight: 1.6 }} />
  )
}

// Rewired onto the shared SearchSelect (searchable single-select dropdown) instead of
// a bare native <select> — every SchemaSection screen upgrades at once (SchemaSection
// routes type 'select' here). External props are unchanged so callers need no edit.
// Single-select: `closeOnToggle` closes the menu on pick, `selected=[value]` marks the
// current choice, and onToggle only fires onChange for an actual change (mirrors the
// ProvincesSettings country-picker reference usage).
export function SelectField({ value, onChange, options, ariaLabel }) {
  const current = options.find(o => o.value === value)
  return (
    <SearchSelect
      closeOnToggle
      options={options}
      selected={[value]}
      onToggle={next => { if (next !== value) onChange(next) }}
      triggerLabel={current?.label ?? value}
      renderTrigger={toggle => (
        <button type="button" onClick={toggle} aria-label={ariaLabel}
          style={{ ...inputStyle, paddingRight: 28, cursor: 'pointer', background: 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 160 }}>
          {current?.label ?? value}
        </button>
      )}
    />
  )
}

// Matches the backend's ChipColor rule (App\Rules\ChipColor, CHIPKLEUR-INSTELBAAR-1):
// a literal hex (#abc / #aabbcc / #aabbccdd) or a var(--color-*) token, max 32 chars.
// Hand-kept in sync with the backend regex — update both together if either changes.
const CHIP_COLOR_PATTERN = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|var\(--color-[a-z0-9-]+\))$/

// Free-text tenant colour field (CHIPKLEUR-INSTELBAAR-1) — distinct from ColorSwatch's
// curated preset picker (used for lookup-value colours): this accepts ANY valid hex or
// design-token string, validates it client-side before it ever reaches the API, and
// treats an empty value as "clear → fall back to the caller's default".
export function ColorField({ value, onChange, invalidLabel, ariaLabel }) {
  const [draft, setDraft] = useState(value ?? '')
  const [invalid, setInvalid] = useState(false)

  // Re-sync the draft when the persisted value changes from outside (swatch, load, reset).
  useEffect(() => { setDraft(value ?? ''); setInvalid(false) }, [value])

  // Commit on blur/Enter only — never flag a still-typing keystroke as an error.
  // Empty is valid (clears the setting); anything else must match the backend pattern.
  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed === '' || CHIP_COLOR_PATTERN.test(trimmed)) {
      setInvalid(false)
      onChange(trimmed)
    } else {
      setInvalid(true)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* The swatch is the PICKER, not a preview. It was a dead square for a day: the
            field had been rebuilt as free text to accept a design token, which made it
            capable and unusable — you could see a colour and not choose one (Danny 02-08).
            The palette is the same one every other lookup colour uses; the text box beside
            it stays for the cases the palette cannot express (a token, a brand hex). */}
        <ColorSwatch color={draft.trim() || 'var(--border)'} onChange={c => { setDraft(c); setInvalid(false); onChange(c) }} />
        <input type="text" value={draft} aria-label={ariaLabel} maxLength={32}
          placeholder="var(--color-secondary)"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          style={{
            ...inputStyle, width: 180, fontSize: 12, fontFamily: 'monospace',
            borderColor: invalid ? 'var(--color-danger)' : 'var(--border)',
          }} />
      </div>
      {invalid && <span role="alert" style={{ fontSize: 11, color: 'var(--color-danger)' }}>{invalidLabel}</span>}
    </div>
  )
}

export function StatusBadge({ label, tone = 'neutral' }) {
  const tones = {
    active:   { c: 'var(--color-success)', bg: 'rgba(16,185,129,0.12)' },
    inactive: { c: 'var(--text-muted)',              bg: 'var(--border)' },
    warning:  { c: 'var(--color-warning)', bg: 'rgba(245,158,11,0.12)' },
    neutral:  { c: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  }
  const s = tones[tone] ?? tones.neutral
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999,
                   fontSize: 12, fontWeight: 600, background: s.bg, color: s.c }}>
      {label}
    </span>
  )
}

export function SkeletonRows({ n = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ ...CARD, height: 58, overflow: 'hidden', position: 'relative' }}>
          <div className="km-skeleton" style={{
            position: 'absolute', inset: 0,
            // eslint-disable-next-line no-restricted-syntax -- no semantic index.css token for this loading-shimmer gradient; kept literal to avoid changing the rendered animation
            background: 'linear-gradient(90deg,#F8FAFC 25%,#EEF2F6 37%,#F8FAFC 63%)',
            backgroundSize: '400% 100%', animation: 'km-shimmer 1.4s ease infinite',
          }} />
        </div>
      ))}
    </div>
  )
}
