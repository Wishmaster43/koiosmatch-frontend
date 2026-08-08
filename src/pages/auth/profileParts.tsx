/**
 * ProfilePage building blocks — small presentational helpers shared by the
 * profile tabs: a status pill, a section card, a labelled field and the
 * underline tab strip, plus the shared input style, role colours and the
 * UI-language list. Kept dumb (no API, no business logic).
 */
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

type IconComp = ComponentType<{ size?: number }>

// The profile form owned by ProfilePage, shared with the Details + Display tabs.
export interface ProfileFormData {
  firstname: string
  lastname: string
  email: string
  phone: string
  default_per_page?: number
}

// UI languages offered in the display tab. Deliberate choice (Danny 2026-07-28):
// a language picker shows each language's own AUTONYM (e.g. "Nederlands" for
// Dutch), never translated into the current UI language — otherwise a French
// user staring at an English UI would hunt for "Dutch" instead of recognising
// "Nederlands". No `label` here: it's still resolved via `t('languageNames.<code>',
// { ns: 'auth' })` at render time (see ProfileDisplayTab), so the string has one
// source of truth per §5 — every locale file simply carries the identical autonym.
// `label` is the ENDONYM — the language's own name. Deliberately not translated: it is
// stored as-is by the company-language setting, so a value written while the UI was in
// English must still match when the UI is Dutch. It is also what a speaker recognises.
// A refactor once dropped this field while CompanySettings still mapped over it, which
// rendered five EMPTY options and made the saved value match nothing (found 28-07 by an
// audit — neither tsc nor the tests saw it: that file is .jsx and had no test).
export const LANGUAGES = [
  { value: 'nl', flag: '🇳🇱', label: 'Nederlands' },
  { value: 'en', flag: '🇬🇧', label: 'English' },
  { value: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { value: 'fr', flag: '🇫🇷', label: 'Français' },
  { value: 'es', flag: '🇪🇸', label: 'Español' },
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

// Shared text-input style for the profile forms (G33/fieldMetrics canon,
// plus the border-color transition this screen already had on focus/hover).
export const inputStyle: CSSProperties = { ...fieldInputStyle, transition: 'border-color 0.15s' }

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
