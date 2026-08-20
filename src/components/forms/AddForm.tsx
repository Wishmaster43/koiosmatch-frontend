/**
 * AddForm — schema-driven inline "add a record" form.
 *
 * Drives every "+ Toevoegen" panel in the candidate drawer (experience, education,
 * languages, certifications, skills, matches). A field is described once and
 * rendered by type; `half` pairs two fields on one row, `separator` puts a "tot"
 * label between a start/end pair.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X } from 'lucide-react'
import RichTextEditor from '@/components/ui/RichTextEditor'
// ALWAYS-SEARCHABLE-1 (Danny 08-08): the house searchable combobox replaces the
// native <select> that used to render every `options` field below.
import CreatableSelect from '@/components/ui/CreatableSelect'
import { TextField, TextArea, DateField, Label } from './fields'
import FieldNotice from '@/components/ui/FieldNotice'
import Button from '@/components/ui/Button'

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
  // KAND-ACHTERGROND-VERPLICHT-1 (2026-08-17, Danny: "staat geen sterrentje bij" /
  // "waarom kan ik opslaan zonder in te vullen?"): this field is required on the
  // backend (CandidateExperienceController::employer etc.) — render the shared
  // Label's asterisk and block Save while it is empty, instead of letting an
  // incomplete row reach the API and bounce back as a raw 422.
  required?: boolean
}

export type FormValues = Record<string, unknown>

// Small stateful wrapper so a richtext AddForm field carries its own expand
// state (mirrors ProfileTab's summaryExpanded) without lifting it into the
// whole form's FormValues.
function RichTextFieldBlock({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <RichTextEditor value={value} onChange={onChange} minHeight={110} resizable
      expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
  )
}

function FieldInput({ f, value, onChange, values, disabled, invalid }: {
  f: FieldDef; value: unknown; onChange: (v: string | boolean) => void; values: FormValues; disabled?: boolean
  // KAND-ACHTERGROND-VERPLICHT-1: true once a blocked Save flagged this required
  // field as empty — drives the red border + the FieldNotice message below it.
  invalid?: boolean
}) {
  const { t } = useTranslation('common')
  // A field's label can switch based on another field (altLabelWhen) — e.g. an
  // education end date becomes "Verwachte einddatum" when "Nog in opleiding" is on.
  const label = (f.altLabelWhen && values?.[f.altLabelWhen]) ? f.altLabel : f.label
  const labelText = typeof label === 'string' ? label : undefined
  // Disabled = greyed + non-interactive (e.g. end date on a current job / always-valid cert).
  const wrap = (node: ReactNode) => disabled
    ? <div style={{ opacity: 0.45, pointerEvents: 'none' }}>{node}</div>
    : node
  // KAND-ACHTERGROND-VERPLICHT-1: a required field is marked with the house
  // asterisk, but INSIDE its placeholder rather than as a caption above it.
  //
  // The first version put a Label above the required field only. In this compact
  // add row the other fields carry a placeholder and no caption, so that one field
  // became taller than its neighbours and the whole row went out of line (Danny
  // 17-08, looking straight at the employer field: "BEDRIJF ziet er niet uit zo").
  // A marker that breaks the layout of the form it is explaining is not an
  // improvement. In the placeholder it is visible, it costs no height, and every
  // field in the row keeps the same box.
  //
  // The inline notice below only appears AFTER Save flagged the field, so it can
  // shift the row exactly once, at the moment the user needs to be told why.
  const requiredChrome = (body: ReactNode) => (
    <div>
      {body}
      {invalid && <FieldNotice text={t('errors.fieldRequired', { field: labelText })} />}
    </div>
  )
  // The placeholder every control below renders, with the asterisk appended when
  // the field is required, so the marker lives in one place instead of per control.
  const placeholder = f.required && labelText ? `${labelText} *` : labelText
  if (f.checkbox) return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {f.label}
    </label>
  )
  // Compact rich-text block: a small caption label above (RichTextEditor has no
  // placeholder slot) + the shared editor at minHeight 48 (the row it belongs to
  // is a couple of lines, not a full page — Danny punt 48, "rode blok te groot").
  // EXPAND-1 (P16, batch 4): every richtext AddForm field gets the same expand
  // toggle as the profile text (ProfileTab.tsx) — a small local-state wrapper
  // owns `expanded` and hands it to RichTextEditor's own expanded/onToggleExpand
  // API; `resizable` stays so the drag handle still works inside the small row form.
  // Reuses the shared Label (KAND-ACHTERGROND-VERPLICHT-1) instead of a private
  // caption div — same look as before (required stays false for every existing
  // richtext caller here), one fewer hand-rolled copy of the same style.
  if (f.richtext) return wrap(
    <div>
      {labelText && <Label required={f.required}>{labelText}</Label>}
      {/* resizable (Danny 08-08: "kan referentie txt niet groter maken?") — the
          shared editor already ships a drag-to-grow handle (MEMORY-RESIZE-1); this
          form never opted in, so a longer note had no room. minHeight raised from
          48 to 110 so a note starts readable and can be dragged taller from there. */}
      <RichTextFieldBlock value={value as string | undefined} onChange={onChange} />
    </div>
  )
  if (f.textarea) return wrap(requiredChrome(<TextArea placeholder={placeholder} value={value as string | undefined} onChange={onChange} rows={2} />))
  if (f.date)     return wrap(requiredChrome(<DateField placeholder={placeholder} value={value as string | undefined} onChange={onChange} />))
  // ALWAYS-SEARCHABLE-1 (Danny 08-08, CLAUDE.md §4): every dropdown is a searchable
  // combobox — the house CreatableSelect (allowCreate={false}, pick-only) replaces
  // the native <select> that used to render every `options` field (education level,
  // linked document, skill level, …). Same value/onChange contract as before, so no
  // caller or request shape changes; `clearable` mirrors the old select's own blank
  // "unset" option. The placeholder carries the accessible name, the same convention
  // every sibling picker in this drawer already uses (LanguagesSection, ZzpAddressCard, …).
  if (f.options)  return requiredChrome(
    // Every real caller's option label is a plain string (tenant lookup labels /
    // document names) — FieldDef.options keeps the wider ReactNode type for label
    // flexibility elsewhere, so narrow it here to what CreatableSelect expects.
    // A resolver form is called with the CURRENT values, so a list may depend on the
    // row being edited (DOC-1-EIGENAAR-1) — see FieldDef.options.
    <CreatableSelect value={(value as string) ?? ''} onChange={onChange} allowCreate={false} clearable
      placeholder={placeholder}
      options={(typeof f.options === 'function' ? f.options(values) : f.options) as Array<string | { value: string; label: string }>}
      style={{ width: '100%', fontSize: 12 }} />,
  )
  return wrap(requiredChrome(<TextField placeholder={placeholder} value={value as string | undefined} onChange={onChange} type={f.type} error={invalid} />))
}

// `initial` (optional) prefills the fields → same form for adding and editing.
export default function AddForm({ fields, onSave, onCancel, initial }: {
  fields: FieldDef[]; onSave: (values: FormValues) => void; onCancel: () => void; initial?: FormValues
}) {
  const { t } = useTranslation('common')
  const [values, setValues] = useState<FormValues>(() => ({ ...Object.fromEntries(fields.map(f => [f.key, ''])), ...(initial ?? {}) }))
  // KAND-ACHTERGROND-VERPLICHT-1: which required fields a blocked Save flagged
  // empty — cleared per-field the moment the user edits it (mirrors
  // AddCandidateModal's own `errors` state, the established convention).
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const set = (k: string, v: string | boolean) => {
    setValues(p => ({ ...p, [k]: v }))
    setInvalid(p => (p[k] ? { ...p, [k]: false } : p))
  }

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
          <FieldInput f={f}    value={values[f.key]}    onChange={v => set(f.key, v)} values={values} disabled={dis(f)} invalid={invalid[f.key]} />
          {f.separator && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('to')}</span>}
          {next && <FieldInput f={next} value={values[next.key]} onChange={v => set(next.key, v)} values={values} disabled={dis(next)} invalid={invalid[next.key]} />}
        </div>
      )
      i++
    } else {
      rows.push(<FieldInput key={f.key} f={f} value={values[f.key]} onChange={v => set(f.key, v)} values={values} disabled={dis(f)} invalid={invalid[f.key]} />)
    }
  }

  // KAND-ACHTERGROND-VERPLICHT-1: block Save while any `required` field is empty
  // — mirrors AddCandidateModal's handleSubmit gate (the established convention):
  // flag every empty required field at once, never call onSave, never fire the
  // request. Points at the field via the asterisk + red border + FieldNotice
  // FieldInput already renders once `invalid` is set, so the user finds out
  // BEFORE the request goes out, not from a raw 422 toast afterwards.
  const handleSave = () => {
    const missing = fields.filter(f => f.required && !String(values[f.key] ?? '').trim())
    if (missing.length) {
      setInvalid(p => ({ ...p, ...Object.fromEntries(missing.map(f => [f.key, true])) }))
      return
    }
    onSave(values)
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
        {/* House Button (HUISSTIJL-1, BTN-5) — an icon save button is Button
            size="sm" iconOnly, never a local iconBtn style constant. */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="primary" size="sm" iconOnly onClick={handleSave} title={t('save')}>
            <Save size={14} />
          </Button>
          <Button variant="secondary" size="sm" iconOnly onClick={onCancel} title={t('cancel')}>
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
