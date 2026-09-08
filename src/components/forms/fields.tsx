/**
 * fields — shared form primitives.
 *
 * One place for the input styling + field building blocks that AddCandidateModal,
 * the candidate drawer tabs and the generic form helpers all share. Previously
 * each file declared its own `iStyle` / `inputStyle` / `dpInputStyle` copy.
 */
import { useId, cloneElement, isValidElement } from 'react'
import type { CSSProperties, ReactNode, ReactElement, KeyboardEvent } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useTranslation } from 'react-i18next'
import { fieldInputStyle } from './fieldMetrics'
import { CANON_LABEL_STYLE } from '@/components/drawer/fieldRowCanon'
import { toLocalIsoDate } from '@/lib/localDate'
import CreatableSelect from '@/components/ui/CreatableSelect'
import Button from '@/components/ui/Button'
import DrawerAddButton from '@/components/drawer/DrawerAddButton'

/* eslint-disable react-refresh/only-export-components -- the shared form KIT
   exports field styles/helpers beside its components by design (§ field layout,
   one sweep source); HMR-nicety only — precedent: usageCardStyles.jsx. */
export interface SelectOption { value: string; label?: ReactNode }

// Canon field style (G33/fieldMetrics) — this was its own one-off (padding
// 8/11, background var(--surface)) before the platform-wide sweep.
export const inputStyle: CSSProperties = fieldInputStyle

// Red asterisk marking a required field; used in Label/FieldRow/Field and inline
// form labels throughout the app. aria-hidden is safe here because the control
// itself carries `aria-required`/`required` (see requiredChildProps below) — the
// asterisk is a visual echo of that state, not the only signal reaching AT.
export const requiredMark = <span aria-hidden="true" style={{ color: 'var(--color-danger-text)', marginLeft: 2 }}>*</span>

// Required-ness props cloned onto a Field/FieldRow child alongside id/aria-labelledby
// (REQUIRED-A11Y-1): every child gets `aria-required` so screen readers announce it
// (WCAG 1.3.1/3.3.2), and a native <input>/<select>/<textarea> also gets a real
// `required` attribute — a custom picker (CreatableSelect/SelectMenu/…) renders its
// own trigger element and manages its own validation, so it only needs the aria hint.
function requiredChildProps(required: boolean | undefined, child: ReactElement): { 'aria-required'?: true; required?: true } {
  if (!required) return {}
  const isNativeControl = typeof child.type === 'string'
  return { 'aria-required': true, ...(isNativeControl ? { required: true } : {}) }
}

/** Parse any date-ish value into a Date, or null when invalid/empty. */
export function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// Field label with the shared muted/uppercase style and a required-asterisk suffix.
export function Label({ children, required, htmlFor, id }: { children: ReactNode; required?: boolean; htmlFor?: string; id?: string }) {
  return (
    <label id={id} htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block',
      marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {children}{required && requiredMark}
    </label>
  )
}

// MODAL-CANON (Danny 13/14-08 "hou het met + Match aan"): the label-LEFT row for
// every create-modal field — label on the canon column width (fieldRowCanon),
// field takes the rest. Same id/aria-labelledby wiring as Field below; ONE
// implementation, so no modal restyles it privately (§3A field-layout rule).
export function FieldRow({ label, required, children }: { label: ReactNode; required?: boolean; children: ReactNode }) {
  const id = useId()
  const labelId = `${id}-label`
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-labelledby'?: string; 'aria-required'?: true; required?: true }>,
        { id, 'aria-labelledby': labelId, ...requiredChildProps(required, children) })
    : children
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <label id={labelId} htmlFor={id} style={{ ...CANON_LABEL_STYLE, paddingTop: 8 }}>
        {label}{required && requiredMark}
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>{child}</div>
    </div>
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
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-labelledby'?: string; 'aria-required'?: true; required?: true }>,
        { id, 'aria-labelledby': labelId, ...requiredChildProps(required, children) })
    : children
  return (
    <div>
      <Label id={labelId} htmlFor={id} required={required}>{label}</Label>
      {child}
    </div>
  )
}

// REQUIRED-A11Y-3: the required flags Field/FieldRow clone onto a kit control; every control
// below forwards them to its native element, else the clone lands on nothing (measured 03-09:
// the customer-name field showed an asterisk and zero aria-required on screen).
type RequiredProps = { required?: boolean; 'aria-required'?: boolean }
const requiredAttrs = ({ required, 'aria-required': ariaRequired }: RequiredProps) =>
  ({ required: required || undefined, 'aria-required': (ariaRequired || required) || undefined })

// Single-line text input on the shared field style, with an optional error-border variant.
// `onKeyDown` is an optional passthrough (e.g. Enter-to-submit on a name field) — the kit
// used to destructure a fixed prop set and silently drop it (regression found on OutreachCreate).
export function TextField({ id, value, onChange, placeholder, type = 'text', error, style, onKeyDown, autoComplete, min, max, 'aria-labelledby': labelledBy, ...req }: {
  id?: string; value?: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: boolean; style?: CSSProperties
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  // Password-manager hint (current-password / new-password / off) — forwarded, never dropped.
  autoComplete?: string
  // Numeric bounds for type="number" (WA-WEB-CAPS-DEFAULT-1: the queue caps mirror the
  // server's per-field maxima) — forwarded onto the input, never dropped.
  min?: number
  max?: number
  'aria-labelledby'?: string
} & RequiredProps) {
  // LABEL-WINS-1 (04-09, measured on the user modals): a Field/FieldRow names the input
  // through its label (aria-labelledby + htmlFor). The placeholder is only an accessible
  // name of last resort for an UNLABELLED input — an aria-label would otherwise beat the
  // visible label and the field would be announced as its example value ("Jan").
  const labelled = Boolean(labelledBy || id)
  return (
    <input id={id} type={type} value={value ?? ''} placeholder={placeholder} autoComplete={autoComplete} min={min} max={max}
      aria-labelledby={labelledBy} aria-label={labelled ? undefined : placeholder} {...requiredAttrs(req)}
      onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
      // The error state replaces the whole `border` shorthand rather than only its
      // colour: React warns when a longhand is removed while the shorthand is still
      // set, and the two can then fight over which wins on re-render.
      style={{ ...inputStyle, ...(error ? { border: '1px solid var(--color-danger)' } : {}), ...style }} />
  )
}

// Multi-line text input on the shared field style, vertically resizable only.
export function TextArea({ id, value, onChange, placeholder, rows = 3, style, ...req }: {
  id?: string; value?: string; onChange: (v: string) => void; placeholder?: string; rows?: number; style?: CSSProperties
} & RequiredProps) {
  return (
    <textarea id={id} value={value ?? ''} placeholder={placeholder} aria-label={placeholder} rows={rows} {...requiredAttrs(req)}
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
// DROPDOWN-CLEAR-1 (Danny 08-09, measured on the WhatsApp-Web number form: "ik kan
// vestiging niet wissen"): the kit forwards the X — a form field is cleared BEFORE
// submit, so even a required pick can be undone; validation still runs on save.
export function SelectField({ id, value, onChange, options = [], placeholder, style, 'aria-labelledby': ariaLabelledBy, clearable, clearLabel, ...req }: {
  id?: string; value?: string; onChange: (v: string) => void; options?: Array<string | SelectOption>; placeholder?: string; style?: CSSProperties; 'aria-labelledby'?: string
  clearable?: boolean; clearLabel?: string
} & RequiredProps) {
  return (
    <CreatableSelect id={id} aria-labelledby={ariaLabelledBy} aria-required={requiredAttrs(req)['aria-required']} value={value ?? ''} onChange={onChange}
      options={options as Array<string | { value: string; label: string }>} placeholder={placeholder} allowCreate={false}
      clearable={clearable} clearLabel={clearLabel}
      style={{ ...inputStyle, cursor: 'pointer', ...style }} />
  )
}

// Date input wrapping the shared DatePicker instance, formatted dd-MM-yyyy for every date field in the app.
export function DateField({ id, value, onChange, placeholder, style, ...req }: {
  id?: string; value?: string | number | Date | null; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties
} & RequiredProps) {
  return (
    <DatePicker
      id={id}
      selected={parseDate(value)}
      // Local calendar day, never `.toISOString()` — see toLocalIsoDate's doc for the
      // measured UTC-shift bug this fixes (this is the SHARED DateField every form uses).
      onChange={(d: Date | null) => onChange(d ? toLocalIsoDate(d) : '')}
      dateFormat="dd-MM-yyyy"
      showMonthDropdown showYearDropdown dropdownMode="select"
      placeholderText={placeholder}
      portalId="datepicker-portal"
      popperPlacement="bottom-start"
      customInput={<input style={{ ...inputStyle, ...style }} {...requiredAttrs(req)} />}
    />
  )
}

// Checkbox input on the shared accent colour; disabled also flips the cursor to default.
export function CheckboxField({ id, checked, onChange, disabled, ...req }: {
  id?: string; checked?: boolean; onChange: (v: boolean) => void; disabled?: boolean
} & RequiredProps) {
  return (
    <input id={id} type="checkbox" checked={!!checked} disabled={disabled} {...requiredAttrs(req)}
      onChange={e => onChange(e.target.checked)}
      style={{ width: 14, height: 14, accentColor: 'var(--color-primary)', cursor: disabled ? 'default' : 'pointer' }} />
  )
}

/**
 * AddButton — every "+ X toevoegen" affordance in a form/section. Danny 08-08:
 * "MOET EEN KNOP ZIJN" — it used to render as bare orange text with a plus,
 * which does not read as clickable and drifted per screen. HUISSTIJL-1 (18-08):
 * this had its own hand-rolled 8%/32% tint recipe instead of the house 10%/33%
 * pair, so it now delegates straight to DrawerAddButton — the ONE "+ add"
 * component app-wide — while keeping its own name/signature so AddableSection's
 * one call-site is untouched.
 */
export function AddButton({ onClick, label }: { onClick: () => void; label?: ReactNode }) {
  return <DrawerAddButton onClick={onClick} label={label} />
}

// Save/Cancel button pair for a form footer, on the house Button variants with translated defaults.
export function SaveCancel({ onSave, onCancel, saveLabel, cancelLabel }: {
  onSave: () => void; onCancel: () => void; saveLabel?: ReactNode; cancelLabel?: ReactNode
}) {
  const { t } = useTranslation('common')
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      {/* Herhaal-audit r4 finding 2's twin: the inverse --text fill is retired —
          the primary action of a form footer wears the house Button. */}
      <Button variant="primary" size="sm" onClick={onSave}>
        {saveLabel ?? t('save')}
      </Button>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        {cancelLabel ?? t('cancel')}
      </Button>
    </div>
  )
}
