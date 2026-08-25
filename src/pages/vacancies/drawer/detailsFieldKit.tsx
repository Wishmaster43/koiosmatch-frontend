/**
 * detailsFieldKit — shared row/card/control-button building blocks for the
 * vacancy Details sub-tabs (Algemeen/Locatie/Eisen/Voorwaarden — "General/
 * Location/Requirements/Conditions"). Split out of
 * the old single DetailsTab (VAC-DETAILS-SPLIT-1, Danny 24-07: "een potlood
 * zet 21 velden tegelijk in edit-mode" — "one pencil puts 21 fields into edit
 * mode at once") so every sub-tab card looks identical
 * without repeating the same style constants and JSX four times.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { Edit2, Save, X } from 'lucide-react'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Button from '@/components/ui/Button'
// HUISSTIJL-1: the card title (11/600/uppercase/muted) is the shared GroupLabel atom.
import { GroupLabel } from '@/components/ui/typography'

// Style constants — identical across every sub-tab card. inputStyle is the
// G33/fieldMetrics canon (was its own padding-7/font-12/radius-6 copy).
export const inputStyle: CSSProperties = fieldInputStyle
export const blockStyle: CSSProperties = { borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }
export const dash = <span style={{ color: 'var(--text-muted)' }}>-</span>

// One label/value row — `editing` picks which of `read`/`edit` renders. Each
// sub-tab passes its OWN editing flag, never a shared one, so a pencil in one
// card can never flip another card's rows into edit mode.
export function row(label: ReactNode, read: ReactNode, edit: ReactNode, editing: boolean) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 26 }}>
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
        <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{title}</GroupLabel>
        {actions}
      </div>
      {/* CANON-BOX (05-08): the card pads once (6/12) and stacks bare rows with gap 2 — 28px pitch. */}
      <div style={{ ...blockStyle, padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  )
}

// Edit-toggle control block (pencil ↔ save/cancel) — one instance per sub-tab
// card, each wired to that section's OWN editing/save/cancel from the hook.
export function controls(t: TFunction, isEditing: boolean, onSave: () => void, onCancel: () => void, onStart: () => void, extra?: ReactNode) {
  return isEditing ? (
    <div style={{ display: 'flex', gap: 4 }}>
      {extra}
      <Button variant="primary" iconOnly size="sm" onClick={onSave} title={t('common:save')} aria-label={t('common:save')}><Save size={13} /></Button>
      <Button variant="secondary" iconOnly size="sm" onClick={onCancel} title={t('common:cancel')} aria-label={t('common:cancel')}><X size={13} /></Button>
    </div>
  ) : (
    <Button variant="secondary" iconOnly size="sm" onClick={onStart} title={t('common:edit')} aria-label={t('common:edit')}><Edit2 size={13} /></Button>
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
  // G35: the searchable, lookup-driven picker — mirrors AddVacancyModal's
  // GeneralCard/RequirementsCard exactly (same CreatableSelect, allowCreate={false},
  // same placeholder) so seniority/education/function/industry use ONE control in
  // both the add modal and the drawer instead of a native <select> here vs a
  // combobox there.
  // CLEAR-SWEEP (Danny 13-08): `clearLabel` is opt-in per call — most callers of this
  // shared helper (seniority/education elsewhere) stay as-is; only fields the caller
  // KNOWS are optional (validated `sometimes|nullable` server-side) pass a label to
  // get the clear cross, so a required field never silently gains one.
  const creatable = (k: K, options: Array<string | { value: string; label: string }>, clearLabel?: string) => (
    <CreatableSelect value={form[k] || null} onChange={(v: string) => setF(k, v)} allowCreate={false}
      {...(clearLabel ? { clearable: true, clearLabel } : {})}
      placeholder={t('common:select')} options={options} />
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
  return { creatable, text, dateInput, twoInputs, twoDates, number, twoNumbers }
}
