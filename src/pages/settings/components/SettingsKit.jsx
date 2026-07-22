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
import { useContext, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, RefreshCw, Save } from 'lucide-react'
import { ColorSwatch } from './SettingsControls'
import { SettingsDirtyContext } from '../lib/settingsDirty'

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
                background: saved ? 'var(--color-success)' : 'var(--color-primary)', color: 'white',
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

export function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 32, height: 18, borderRadius: 999, border: 'none', cursor: 'pointer',
               background: checked ? 'var(--color-primary)' : 'var(--border)', position: 'relative',
               transition: 'background 0.15s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
                    borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.15s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

const inputStyle = {
  height: 34, padding: '0 10px', fontSize: 14, color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 8, outline: 'none', fontFamily: 'inherit',
}

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

export function SelectField({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, paddingRight: 28, cursor: 'pointer', background: 'var(--surface)' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function ColorField({ value, onChange }) {
  return <ColorSwatch color={value} onChange={onChange} />
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
            background: 'linear-gradient(90deg,#F8FAFC 25%,#EEF2F6 37%,#F8FAFC 63%)',
            backgroundSize: '400% 100%', animation: 'km-shimmer 1.4s ease infinite',
          }} />
        </div>
      ))}
    </div>
  )
}
