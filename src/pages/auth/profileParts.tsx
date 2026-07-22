/**
 * ProfilePage building blocks — small presentational helpers shared by the
 * profile tabs: a status pill, a section card, a labelled field and the
 * underline tab strip, plus the shared input style, role colours and the
 * UI-language list. Kept dumb (no API, no business logic).
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react'

type IconComp = ComponentType<{ size?: number }>

// The profile form owned by ProfilePage, shared with the Details + Display tabs.
export interface ProfileFormData {
  firstname: string
  lastname: string
  email: string
  phone: string
  default_per_page?: number
}

// UI languages offered in the display tab + header language picker.
export const LANGUAGES = [
  { value: 'nl', label: 'Nederlands',  flag: '🇳🇱' },
  { value: 'en', label: 'English',     flag: '🇬🇧' },
  { value: 'de', label: 'Deutsch',     flag: '🇩🇪' },
  { value: 'fr', label: 'Français',    flag: '🇫🇷' },
  { value: 'es', label: 'Español',     flag: '🇪🇸' },
]

// Role → colour (mirrors UsersPage). Label comes from the `users` i18n namespace.
// All tokens (never ad-hoc hex) so the chip stays correct in dark mode too.
export const ROLE_META: Record<string, { color: string; bg: string }> = {
  super_admin:  { color: 'var(--color-violet)', bg: 'var(--color-violet-bg)' },
  tenant_admin: { color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
  admin:        { color: 'var(--color-secondary)', bg: 'var(--color-secondary-bg)' },
  planner:      { color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  default:      { color: 'var(--text-muted)', bg: 'color-mix(in srgb, var(--text-muted) 12%, transparent)' },
}

// Shared text-input style for the profile forms.
export const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  background: 'var(--input-bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
  transition: 'border-color 0.15s',
}

// Small coloured chip — used for roles and linked locations. Border uses
// color-mix (not a hex-alpha string suffix) so it stays valid once `color` is a
// CSS var() token, and stays correct across light/dark automatically.
export function Pill({ label, color = 'var(--text-muted)', bg = 'color-mix(in srgb, var(--text-muted) 12%, transparent)', icon: Icon }: {
  label: ReactNode; color?: string; bg?: string; icon?: IconComp
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color,
                   border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`, borderRadius: 999, padding: '3px 10px',
                   fontSize: 12, fontWeight: 500 }}>
      {Icon && <Icon size={11} />}{label}
    </span>
  )
}

// Card wrapper with an uppercase section title.
export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
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

// Labelled form field — label above the control.
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

export interface ProfileTabItem { id: string; label: ReactNode; icon?: IconComp }

// Underline tab strip — same visual language as the settings area.
export function ProfileTabs({ tabs, active, onSelect }: { tabs: ProfileTabItem[]; active: string; onSelect: (id: string) => void }) {
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
