/**
 * fields — shared form primitives.
 *
 * One place for the input styling + field building blocks that AddCandidateModal,
 * the candidate drawer tabs and the generic form helpers all share. Previously
 * each file declared its own `iStyle` / `inputStyle` / `dpInputStyle` copy.
 */
import { useId, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode, ReactElement } from 'react'
import { ChevronDown } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useTranslation } from 'react-i18next'

export interface SelectOption { value: string; label?: ReactNode }

export const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 11px', fontSize: 13, borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', boxSizing: 'border-box', outline: 'none',
}

/** Parse any date-ish value into a Date, or null when invalid/empty. */
export function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block',
      marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
    </label>
  )
}

// Associates the label with its single input via a generated id (§6) — works for
// every Field child that forwards `id` (TextField/SelectField/DateField/…).
export function Field({ label, required, children }: { label: ReactNode; required?: boolean; children: ReactNode }) {
  const id = useId()
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
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

export function SelectField({ id, value, onChange, options = [], placeholder, style }: {
  id?: string; value?: string; onChange: (v: string) => void; options?: Array<string | SelectOption>; placeholder?: string; style?: CSSProperties
}) {
  const opts: SelectOption[] = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div style={{ position: 'relative' }}>
      <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value)} aria-label={placeholder}
        style={{ ...inputStyle, appearance: 'none', paddingRight: 30, cursor: 'pointer', ...style }}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%',
        transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
    </div>
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
export function AddButton({ onClick, label }: { onClick: () => void; label?: ReactNode }) {
  const { t } = useTranslation('common')
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500,
        color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
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
          background: 'var(--text)', color: '#fff', border: 'none', cursor: 'pointer' }}>
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
