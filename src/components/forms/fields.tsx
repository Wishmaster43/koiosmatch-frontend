/**
 * fields — shared form primitives.
 *
 * One place for the input styling + field building blocks that AddCandidateModal,
 * the candidate drawer tabs and the generic form helpers all share. Previously
 * each file declared its own `iStyle` / `inputStyle` / `dpInputStyle` copy.
 */
import { useId, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode, ReactElement } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useTranslation } from 'react-i18next'
import { fieldInputStyle } from './fieldMetrics'
import CreatableSelect from '@/components/ui/CreatableSelect'

export interface SelectOption { value: string; label?: ReactNode }

// Canon field style (G33/fieldMetrics) — this was its own one-off (padding
// 8/11, background var(--surface)) before the platform-wide sweep.
export const inputStyle: CSSProperties = fieldInputStyle

/** Parse any date-ish value into a Date, or null when invalid/empty. */
export function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function Label({ children, required, htmlFor, id }: { children: ReactNode; required?: boolean; htmlFor?: string; id?: string }) {
  return (
    <label id={id} htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block',
      marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

// Associates the label with its single input via a generated id (§6) — works for
// every Field child that forwards `id` (TextField/SelectField/DateField/…).
export function Field({ label, required, children }: { label: ReactNode; required?: boolean; children: ReactNode }) {
  const id = useId()
  // `htmlFor` only names LABELABLE elements — an <input> hears it, a <button> does
  // not. The custom pickers (CreatableSelect/SelectMenu) render a button, so their
  // visible label was orphaned: a screen reader announced "Beschikbaar, button" with
  // no field name (measured 27-07, across every picker in every modal). Handing the
  // label's own id down as aria-labelledby names those too; labelable children simply
  // resolve to the same text, so nothing regresses.
  const labelId = `${id}-label`
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-labelledby'?: string }>, { id, 'aria-labelledby': labelId })
    : children
  return (
    <div>
      <Label id={labelId} htmlFor={id} required={required}>{label}</Label>
      {child}
    </div>
  )
}

export function TextField({ id, value, onChange, placeholder, type = 'text', error, style }: {
  id?: string; value?: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: boolean; style?: CSSProperties
}) {
  return (
    <input id={id} type={type} value={value ?? ''} placeholder={placeholder} aria-label={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, ...(error ? { borderColor: 'var(--color-danger)' } : {}), ...style }} />
  )
}

export function TextArea({ id, value, onChange, placeholder, rows = 3, style }: {
  id?: string; value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number; style?: CSSProperties
}) {
  return (
    <textarea id={id} value={value ?? ''} placeholder={placeholder} aria-label={placeholder} rows={rows}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, resize: 'vertical', ...style }} />
  )
}

// SELECT-SEARCHABLE-1 (Danny 08-08, CLAUDE.md §4: every dropdown is a searchable
// combobox): rewired onto the shared CreatableSelect (allowCreate=false, pick-only)
// instead of a bare native <select> — same value/onChange contract, so no caller
// changes shape. `aria-labelledby` (cloned in by the Field wrapper above) now
// reaches the trigger directly, since a <button> — unlike a native <select> — is
// not labelable via `htmlFor`; `placeholder` still carries the name for callers
// that render this standalone (no wrapping <Field>), same as TextField/TextArea.
export function SelectField({ id, value, onChange, options = [], placeholder, style, 'aria-labelledby': ariaLabelledBy }: {
  id?: string; value?: string; onChange: (v: string) => void; options?: Array<string | SelectOption>; placeholder?: string; style?: CSSProperties; 'aria-labelledby'?: string
}) {
  return (
    <CreatableSelect id={id} aria-labelledby={ariaLabelledBy} value={value ?? ''} onChange={onChange}
      options={options as Array<string | { value: string; label: string }>} placeholder={placeholder} allowCreate={false}
      style={{ ...inputStyle, cursor: 'pointer', ...style }} />
  )
}

export function DateField({ id, value, onChange, placeholder, style }: {
  id?: string; value?: string | number | Date | null; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties
}) {
  return (
    <DatePicker
      id={id}
      selected={parseDate(value)}
      onChange={(d: Date | null) => onChange(d ? d.toISOString().slice(0, 10) : '')}
      dateFormat="dd-MM-yyyy"
      showMonthDropdown showYearDropdown dropdownMode="select"
      placeholderText={placeholder}
      portalId="datepicker-portal"
      popperPlacement="bottom-start"
      customInput={<input style={{ ...inputStyle, ...style }} />}
    />
  )
}

export function CheckboxField({ id, checked, onChange, disabled }: {
  id?: string; checked?: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <input id={id} type="checkbox" checked={!!checked} disabled={disabled}
      onChange={e => onChange(e.target.checked)}
      style={{ width: 14, height: 14, accentColor: 'var(--color-primary)', cursor: disabled ? 'default' : 'pointer' }} />
  )
}

/** "+ label" ghost button used at the top of every addable section. */
/**
 * AddButton — every "+ X toevoegen" affordance in a form/section. Danny 08-08:
 * "MOET EEN KNOP ZIJN" — it used to render as bare orange text with a plus,
 * which does not read as clickable and drifted per screen. Now it is a real
 * bordered button in the §4 soft-tint recipe, matching DrawerAddButton so the
 * add action looks identical in a drawer tab and in a form section.
 */
export function AddButton({ onClick, label }: { onClick: () => void; label?: ReactNode }) {
  const { t } = useTranslation('common')
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500,
        padding: '5px 11px', borderRadius: 8, cursor: 'pointer', color: 'var(--color-primary-text)',
        background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 32%, transparent)' }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> {label ?? t('add')}
    </button>
  )
}

export function SaveCancel({ onSave, onCancel, saveLabel, cancelLabel }: {
  onSave: () => void; onCancel: () => void; saveLabel?: ReactNode; cancelLabel?: ReactNode
}) {
  const { t } = useTranslation('common')
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <button onClick={onSave}
        style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
          // Inverted button: fill = --text, so the label must be its exact theme
          // opposite (--surface), never a hardcoded white — a fixed white on
          // --text vanished in dark mode where --text itself turns near-white
          // (WCAG contrast audit 2026-08-08).
          background: 'var(--text)', color: 'var(--surface)', border: 'none', cursor: 'pointer' }}>
        {saveLabel ?? t('save')}
      </button>
      <button onClick={onCancel}
        style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8,
          background: 'none', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
        {cancelLabel ?? t('cancel')}
      </button>
    </div>
  )
}
