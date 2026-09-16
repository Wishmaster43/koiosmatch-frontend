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
 *   SettingsStatusBadge — inline "active / not connected" pill (settings' own
 *                         tone API; renamed from StatusBadge, HUISSTIJL-1, to stop
 *                         colliding with the unrelated shared components/ui/StatusBadge)
 *   SkeletonRows      — loading placeholder
 *   SettingsDirtyContext — lets the shell warn before leaving an unsaved section
 */
import { useContext, useEffect, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, Save } from 'lucide-react'
import { SettingsDirtyContext } from '../lib/settingsDirty'
import ToggleUi from '@/components/ui/Toggle'
import NumberInput from '@/components/ui/NumberInput'
import Spinner from '@/components/ui/Spinner'
import SearchSelect from '@/components/ui/SearchSelect'
import SaveButton from '@/components/ui/SaveButton'
// PRE-EXISTING BUG FIX (found while verifying this task, unrelated to SUB-TABS-1/
// TENANT-DEFAULT-1 itself): ColorField's palette-swatch rebuild (Danny 02-08) called
// <ColorSwatch> without ever importing it, so EVERY `type: 'color'` schema field threw
// on mount — including the pre-existing customerDisplay chip-colour fields, which
// broke this task's own verification run. One-line fix: import the sibling component.
import { ColorSwatch } from './SettingsControls'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { PageTitle, Caption } from '@/components/ui/typography'

const CARD = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
}

// The one settings-section shell: title/subtitle, the shared dirty-aware save button, and loading/error/content states.
// The dirty/saving/save-state a useSettingsForm() call returns; SettingsScaffold only reads these five.
export interface SettingsFormState {
  dirty?: boolean
  saving?: boolean
  saved?: boolean
  loading?: boolean
  loadError?: boolean
  save?: () => void
}
interface SettingsScaffoldProps {
  title?: ReactNode
  subtitle?: ReactNode
  form?: SettingsFormState
  maxWidth?: number
  actions?: ReactNode
  children?: ReactNode
}
export function SettingsScaffold({ title, subtitle, form, maxWidth, actions, children }: SettingsScaffoldProps) {
  const { t } = useTranslation('settings')
  // SettingsDirtyContext lives in untyped lib/settingsDirty.js (createContext(null)),
  // so useContext infers `never` here — cast to the real shape the shell provides.
  const dirtyCtx = useContext(SettingsDirtyContext) as { report: (d: boolean) => void } | null
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
        {/* CATALOG-GROUPS-1: an EMBEDDED block (a catalogue section under a dedicated screen)
            passes no title — the host screen already has one; the Save bar still renders. */}
        <div style={{ minWidth: 0 }}>
          {title && <PageTitle>{title}</PageTitle>}
          {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
        </div>
        <div className="flex items-center" style={{ gap: 8, flexShrink: 0 }}>
          {actions}
          {/* The ONE save button every settings section renders through — SaveButton
              owns the §4 success TOKEN PAIR (bg/border/ink), never approximated here. */}
          {save && (
            <SaveButton saved={saved} onClick={save} disabled={!canSave}>
              {saved  ? <><Check size={13} /> {t('common.saved')}</>                                :
               saving ? <><Spinner size={13} /> {t('common.saving')}</> :
                        <><Save size={13} /> {t('common.save')}</>}
            </SaveButton>
          )}
        </div>
      </div>

      {loading ? <SkeletonRows /> : loadError ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--color-danger-text)', fontSize: 13 }}>
          <AlertTriangle size={14} /> {t('common.loadError')}
        </div>
      ) : children}
    </div>
  )
}

// The white bordered card every settings row/section renders inside.
export function SettingCard({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...CARD, padding: '14px 16px', ...style }}>{children}</div>
}

// A list of cards with consistent vertical rhythm.
export function SettingCardList({ children }: { children?: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
}

// One label+description/control row inside a SettingCard, the standard settings row layout.
interface SettingRowProps { label: ReactNode; description?: ReactNode; children?: ReactNode }
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <SettingCard style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {description && <Caption as="div" style={{ marginTop: 2 }}>{description}</Caption>}
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

// Right-aligned numeric input with an optional unit suffix, for settings that store a plain number.
interface NumberFieldProps {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  unit?: ReactNode
  width?: number | string
  disabled?: boolean
  step?: number
  ariaLabel?: string
  decimals?: number
  onCommit?: (n: number | null) => void
}
export function NumberField({ value, onChange, min = 0, max, unit, width = 96, disabled = false, step, ariaLabel, decimals, onCommit }: NumberFieldProps) {
  // GETALLEN-1 also inside inputs: the house NumberInput shows 1.250, not 1250; `step`
  // with a fraction implies the decimals a schema wants (0.01 → 2), an explicit
  // `decimals` wins. The callers keep receiving a number (0 when the field is emptied),
  // exactly what the old type="number" handed them.
  const dec = decimals ?? (step && step < 1 ? Math.max(0, Math.ceil(-Math.log10(step))) : 0)
  return (
    <NumberInput value={value} onChange={n => onChange(n ?? 0)} min={min} max={max} decimals={dec}
      width={width} unit={unit} disabled={disabled} ariaLabel={ariaLabel} onCommit={onCommit}
      style={{ fontWeight: 600 }} />
  )
}

// Plain single-line text input sized for settings rows; optional password type.
interface TextFieldProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  width?: number | string
  disabled?: boolean
  type?: string
}
export function TextField({ value, onChange, placeholder, width = 220, disabled = false, type = 'text' }: TextFieldProps) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{ ...inputStyle, width }} />
  )
}

// Multi-line text input for short settings values; not rich text since this kit is for config strings, not prose.
interface TextareaFieldProps {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  minHeight?: number
  disabled?: boolean
  ariaLabel?: string
  mono?: boolean
  invalid?: boolean
}
export function TextareaField({ value, onChange, onBlur, placeholder, minHeight = 220, disabled = false, ariaLabel, mono = false, invalid = false }: TextareaFieldProps) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder}
      disabled={disabled} aria-label={ariaLabel} aria-invalid={invalid || undefined}
      style={{ width: '100%', minHeight, padding: 14, fontSize: 13,
               border: `1px solid ${invalid ? 'var(--color-danger)' : 'var(--border)'}`,
               borderRadius: 10, outline: 'none', resize: 'vertical', color: 'var(--text)',
               fontFamily: mono ? 'var(--font-mono)' : 'inherit', lineHeight: 1.6,
               opacity: disabled ? 0.6 : 1 }} />
  )
}

// Rewired onto the shared SearchSelect (searchable single-select dropdown) instead of
// a bare native <select> — every SchemaSection screen upgrades at once (SchemaSection
// routes type 'select' here). External props are unchanged so callers need no edit.
// Single-select: `closeOnToggle` closes the menu on pick, `selected=[value]` marks the
// current choice, and onToggle only fires onChange for an actual change (mirrors the
// ProvincesSettings country-picker reference usage).
interface SelectOption { value: string; label: string }
interface SelectFieldProps {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  ariaLabel?: string
  disabled?: boolean
  // DROPDOWN-CLEAR-1 default is on; a field whose value must never be empty
  // (a required select that always persists) passes clearable={false} with a
  // written reason directly above the call site.
  clearable?: boolean
}
export function SelectField({ value, onChange, options, ariaLabel, disabled = false, clearable = true }: SelectFieldProps) {
  const current = options.find(o => o.value === value)
  return (
    <SearchSelect
      closeOnToggle
      clearable={clearable}
      options={options}
      selected={[value]}
      onToggle={next => { if (next !== value) onChange(next) }}
      triggerLabel={current?.label ?? value}
      disabled={disabled}
      renderTrigger={toggle => (
        <button type="button" onClick={toggle} aria-label={ariaLabel} disabled={disabled}
          // eslint-disable-next-line huisstijlLegacy/no-restricted-syntax -- dropdown trigger rendering the current field value, mirrors the house field-input chrome, not a Button
          style={{ ...inputStyle, paddingRight: 28, cursor: disabled ? 'default' : 'pointer', background: 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 160, opacity: disabled ? 0.6 : 1 }}>
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
interface ColorFieldProps {
  value?: string
  onChange: (v: string) => void
  invalidLabel?: ReactNode
  ariaLabel?: string
  disabled?: boolean
}
export function ColorField({ value, onChange, invalidLabel, ariaLabel, disabled = false }: ColorFieldProps) {
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, opacity: disabled ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* The swatch is the PICKER, not a preview. It was a dead square for a day: the
            field had been rebuilt as free text to accept a design token, which made it
            capable and unusable — you could see a colour and not choose one (Danny 02-08).
            The palette is the same one every other lookup colour uses; the text box beside
            it stays for the cases the palette cannot express (a token, a brand hex). */}
        <ColorSwatch color={draft.trim() || 'var(--border)'} onChange={c => { setDraft(c); setInvalid(false); onChange(c) }} disabled={disabled} />
        <input type="text" value={draft} aria-label={ariaLabel} maxLength={32} disabled={disabled}
          placeholder="var(--color-secondary)"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          style={{
            ...inputStyle, width: 180, fontSize: 12, fontFamily: 'monospace',
            borderColor: invalid ? 'var(--color-danger)' : 'var(--border)',
          }} />
      </div>
      {invalid && <span role="alert" style={{ fontSize: 11, color: 'var(--color-danger-text)' }}>{invalidLabel}</span>}
    </div>
  )
}

// HUISSTIJL-1: renamed from StatusBadge — that name collided with the unrelated
// shared components/ui/StatusBadge.tsx (a map-keyed status chip). This one is
// settings' own simpler tone-only API (active/inactive/warning/neutral) and has

export function SkeletonRows({ n = 3 }: { n?: number }) {
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
