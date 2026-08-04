import type { CSSProperties, ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Edit2, Save, X } from 'lucide-react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'

/**
 * detailsFieldKit — shared row/card/control-button building blocks for the
 * vacancy Details sub-tabs (Algemeen/Locatie/Eisen/Voorwaarden). Split out of
 * the old single DetailsTab (VAC-DETAILS-SPLIT-1, Danny 24-07: "een potlood
 * zet 21 velden tegelijk in edit-mode") so every sub-tab card looks identical
 * without repeating the same style constants and JSX four times.
 */

// Style constants — identical across every sub-tab card.
export const inputStyle: CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }
export const iconBtn: CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
export const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
export const groupTitleText: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }
export const groupTitle: CSSProperties = { ...groupTitleText, marginBottom: 3 }
export const dash = <span style={{ color: 'var(--text-muted)' }}>-</span>

// One label/value row — `editing` picks which of `read`/`edit` renders. Each
// sub-tab passes its OWN editing flag, never a shared one, so a pencil in one
// card can never flip another card's rows into edit mode.
export function row(label: ReactNode, read: ReactNode, edit: ReactNode, editing: boolean) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26, padding: '5px 0' }}>
      {/* Canon label style (fieldRowCanon, 05-08): was width:130, aligned to candidate ProfileTab's 120. */}
      <span style={CANON_LABEL_STYLE}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)' }}>{editing ? edit : read}</div>
    </div>
  )
}

// Card wrapper — `actions` (the pencil/save/cancel controls) renders right-
// aligned in the title row itself, so each sub-tab's own pencil never needs an
// extra empty band above its rows.
export function card(title: ReactNode, children: ReactNode, actions?: ReactNode) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={groupTitleText}>{title}</span>
        {actions}
      </div>
      <div style={{ ...blockStyle, padding: '2px 12px' }}>{children}</div>
    </div>
  )
}

// Edit-toggle control block (pencil ↔ save/cancel) — one instance per sub-tab
// card, each wired to that section's OWN editing/save/cancel from the hook.
export function controls(t: TFunction, isEditing: boolean, onSave: () => void, onCancel: () => void, onStart: () => void, extra?: ReactNode) {
  return isEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      {extra}
      <button onClick={onSave} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
      <button onClick={onCancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
    </div>
  ) : (
    <button onClick={onStart} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
  )
}

// Pure display formatters — no form/state dependency, safe to share as-is.
export function pair(min: string, max: string, suffix?: string): string {
  const s = [min, max].filter(Boolean).join(' – ')
  return s ? `${s}${suffix ? ` ${suffix}` : ''}` : ''
}
export function dateRange(formatDate: (d: string) => string, a: string, b: string): string {
  return [a, b].filter(Boolean).map(d => formatDate(d)).join(' – ')
}

// Form-bound input builders — one factory call per sub-tab, parameterised over
// its OWN key union/form/setF so each section's inputs only ever write their
// own slice of state (never another sub-tab's draft).
export function makeFieldHelpers<K extends string>(form: Record<K, string>, setF: (k: K, val: string) => void, t: TFunction) {
  const select = (k: K, options: { value: string; label: string }[]) => (
    <select value={form[k]} onChange={e => setF(k, e.target.value)} style={inputStyle}>
      <option value="">{t('common:select')}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  const text = (k: K, placeholder?: string) => (
    <input value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={placeholder} style={inputStyle} />
  )
  const dateInput = (k: K) => <input type="date" value={form[k]} onChange={e => setF(k, e.target.value)} style={inputStyle} />
  const twoInputs = (a: K, b: K, pa: string, pb: string) => <div style={{ display: 'flex', gap: 6 }}>{text(a, pa)}{text(b, pb)}</div>
  const twoDates = (a: K, b: K) => <div style={{ display: 'flex', gap: 6 }}>{dateInput(a)}{dateInput(b)}</div>
  // V12/V13 (Danny vacatures-ronde): the backend validates these as `integer`/
  // `numeric` (experience_min/max_years, hours_min/max, salary_min/max — see
  // StoreVacancyRequest) — a number input, never free text, so the browser and
  // the form itself reject non-numeric keystrokes instead of relying only on
  // the server 422.
  const number = (k: K, placeholder?: string, opts?: { min?: number; max?: number; step?: number }) => (
    <input type="number" value={form[k]} onChange={e => setF(k, e.target.value)} placeholder={placeholder}
      min={opts?.min} max={opts?.max} step={opts?.step ?? 1} style={inputStyle} />
  )
  const twoNumbers = (a: K, b: K, pa: string, pb: string, opts?: { min?: number; max?: number; step?: number }) =>
    <div style={{ display: 'flex', gap: 6 }}>{number(a, pa, opts)}{number(b, pb, opts)}</div>
  return { select, text, dateInput, twoInputs, twoDates, number, twoNumbers }
}
