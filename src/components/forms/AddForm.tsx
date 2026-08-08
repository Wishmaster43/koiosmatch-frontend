/**
 * AddForm — schema-driven inline "add a record" form.
 *
 * Drives every "+ Toevoegen" panel in the candidate drawer (experience, education,
 * languages, certifications, skills, matches). A field is described once and
 * rendered by type; `half` pairs two fields on one row, `separator` puts a "tot"
 * label between a start/end pair.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
// ALWAYS-SEARCHABLE-1 (Danny 08-08): the house searchable combobox replaces the
// native <select> that used to render every `options` field below.
import CreatableSelect from '@/components/ui/CreatableSelect'
import { TextField, TextArea, DateField } from './fields'

/** One dropdown's option list — a bare string or a {value,label} pair. */
export type FieldOptions = Array<string | { value: string; label?: ReactNode }>

export interface FieldDef {
  key: string
  label?: ReactNode
  altLabel?: ReactNode
  altLabelWhen?: string
  checkbox?: boolean
  textarea?: boolean
  // Rendered as the shared RichTextEditor (house rule: free text = rich-text block).
  // Lets a description live in the SAME edit form as the row's other fields — one
  // pencil per entry (DRAWER-ONE-PENCIL-1, Danny 05-08) instead of a second,
  // field-level pencil bolted onto the read view.
  richtext?: boolean
  date?: boolean
  // A static option list, or a RESOLVER that receives the form's current values so a
  // list can depend on the row being edited (DOC-1-EIGENAAR-1: the linked-document
  // picker must hide documents already claimed by another entry while keeping this
  // row's own pick visible). Additive — every existing caller passes an array.
  options?: FieldOptions | ((values: FormValues) => FieldOptions)
  type?: string
  half?: boolean
  separator?: boolean
  // Conditional visibility/enablement driven by another field's boolean value:
  // hideWhen removes the field entirely, disabledWhen greys it out (read-only).
  hideWhen?: string
  disabledWhen?: string
}

export type FormValues = Record<string, unknown>

function FieldInput({ f, value, onChange, values, disabled }: {
  f: FieldDef; value: unknown; onChange: (v: string | boolean) => void; values: FormValues; disabled?: boolean
}) {
  // A field's label can switch based on another field (altLabelWhen) — e.g. an
  // education end date becomes "Verwachte einddatum" when "Nog in opleiding" is on.
  const label = (f.altLabelWhen && values?.[f.altLabelWhen]) ? f.altLabel : f.label
  const labelText = typeof label === 'string' ? label : undefined
  // Disabled = greyed + non-interactive (e.g. end date on a current job / always-valid cert).
  const wrap = (node: ReactNode) => disabled
    ? <div style={{ opacity: 0.45, pointerEvents: 'none' }}>{node}</div>
    : node
  if (f.checkbox) return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {f.label}
    </label>
  )
  // Compact rich-text block: a small caption label above (RichTextEditor has no
  // placeholder slot) + the shared editor at minHeight 48 (the row it belongs to
  // is a couple of lines, not a full page — Danny punt 48, "rode blok te groot").
  if (f.richtext) return wrap(
    <div>
      {labelText && (
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 5 }}>
          {labelText}
        </div>
      )}
      {/* resizable (Danny 08-08: "kan referentie txt niet groter maken?") — the
          shared editor already ships a drag-to-grow handle (MEMORY-RESIZE-1); this
          form never opted in, so a longer note had no room. minHeight raised from
          48 to 110 so a note starts readable and can be dragged taller from there. */}
      <RichTextEditor value={value as string | undefined} onChange={onChange} minHeight={110} resizable />
    </div>
  )
  if (f.textarea) return wrap(<TextArea placeholder={labelText} value={value as string | undefined} onChange={onChange} rows={2} />)
  if (f.date)     return wrap(<DateField placeholder={labelText} value={value as string | undefined} onChange={onChange} />)
  // ALWAYS-SEARCHABLE-1 (Danny 08-08, CLAUDE.md §4): every dropdown is a searchable
  // combobox — the house CreatableSelect (allowCreate={false}, pick-only) replaces
  // the native <select> that used to render every `options` field (education level,
  // linked document, skill level, …). Same value/onChange contract as before, so no
  // caller or request shape changes; `clearable` mirrors the old select's own blank
  // "unset" option. The placeholder carries the accessible name, the same convention
  // every sibling picker in this drawer already uses (LanguagesSection, ZzpAddressCard, …).
  if (f.options)  return (
    // Every real caller's option label is a plain string (tenant lookup labels /
    // document names) — FieldDef.options keeps the wider ReactNode type for label
    // flexibility elsewhere, so narrow it here to what CreatableSelect expects.
    // A resolver form is called with the CURRENT values, so a list may depend on the
    // row being edited (DOC-1-EIGENAAR-1) — see FieldDef.options.
    <CreatableSelect value={(value as string) ?? ''} onChange={onChange} allowCreate={false} clearable
      placeholder={labelText}
      options={(typeof f.options === 'function' ? f.options(values) : f.options) as Array<string | { value: string; label: string }>}
      style={{ width: '100%', fontSize: 12 }} />
  )
  return wrap(<TextField placeholder={labelText} value={value as string | undefined} onChange={onChange} type={f.type} />)
}

// `initial` (optional) prefills the fields → same form for adding and editing.
export default function AddForm({ fields, onSave, onCancel, initial }: {
  fields: FieldDef[]; onSave: (values: FormValues) => void; onCancel: () => void; initial?: FormValues
}) {
  const { t } = useTranslation('common')
  const [values, setValues] = useState<FormValues>(() => ({ ...Object.fromEntries(fields.map(f => [f.key, ''])), ...(initial ?? {}) }))
  const set = (k: string, v: string | boolean) => setValues(p => ({ ...p, [k]: v }))
  const iconBtn: CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer' }

  // Fields whose hideWhen condition is active drop out entirely (pairing runs on what's left).
  const dis = (f: FieldDef) => !!(f.disabledWhen && values[f.disabledWhen])
  const visibleFields = fields.filter(f => !(f.hideWhen && values[f.hideWhen]))
  // The checkbox field ("Huidige functie" / "Nog in opleiding" / "Altijd geldig")
  // shares one line with the save/cancel buttons instead of its own row — wherever
  // it sits in the field list, so every section puts it in the same compact spot
  // (Danny 17-07, punten 1+2). Conditional fields around it (hideWhen/altLabel)
  // keep working: they reference the field by key, not by position.
  const cbIndex = visibleFields.findLastIndex(f => f.checkbox)
  const footerCheckbox = cbIndex >= 0 ? visibleFields[cbIndex] : null
  const rowFields = footerCheckbox ? visibleFields.filter((_, i) => i !== cbIndex) : visibleFields
  const rows: ReactNode[] = []
  for (let i = 0; i < rowFields.length; i++) {
    const f = rowFields[i]
    const next = rowFields[i + 1]
    if ((f.half && next?.half) || f.separator) {
      rows.push(
        <div key={f.key} style={f.separator
          ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }
          : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FieldInput f={f}    value={values[f.key]}    onChange={v => set(f.key, v)} values={values} disabled={dis(f)} />
          {f.separator && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('to')}</span>}
          {next && <FieldInput f={next} value={values[next.key]} onChange={v => set(next.key, v)} values={values} disabled={dis(next)} />}
        </div>
      )
      i++
    } else {
      rows.push(<FieldInput key={f.key} f={f} value={values[f.key]} onChange={v => set(f.key, v)} values={values} disabled={dis(f)} />)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10,
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: footerCheckbox ? 'space-between' : 'flex-end', gap: 6 }}>
        {footerCheckbox && (
          <FieldInput f={footerCheckbox} value={values[footerCheckbox.key]}
            onChange={v => set(footerCheckbox.key, v)} values={values} disabled={dis(footerCheckbox)} />
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onSave(values)} title={t('save')}
            // Accent-filled save button — follow the tenant's on-accent contrast
            // token instead of a hardcoded white (2026-08-08).
            style={{ ...iconBtn, background: 'var(--color-primary)', color: 'var(--color-on-accent)', border: 'none' }}>
            <Save size={14} />
          </button>
          <button onClick={onCancel} title={t('cancel')}
            style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
