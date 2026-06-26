/**
 * AddForm — schema-driven inline "add a record" form.
 *
 * Drives every "+ Toevoegen" panel in the candidate drawer (experience, education,
 * languages, certifications, skills, placements). A field is described once and
 * rendered by type; `half` pairs two fields on one row, `separator` puts a "tot"
 * label between a start/end pair.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X } from 'lucide-react'
import { TextField, TextArea, DateField } from './fields'

export interface FieldDef {
  key: string
  label?: ReactNode
  altLabel?: ReactNode
  altLabelWhen?: string
  checkbox?: boolean
  textarea?: boolean
  date?: boolean
  options?: Array<string | { value: string; label?: ReactNode }>
  type?: string
  half?: boolean
  separator?: boolean
}

type FormValues = Record<string, unknown>

function FieldInput({ f, value, onChange, values }: {
  f: FieldDef; value: unknown; onChange: (v: string | boolean) => void; values: FormValues
}) {
  // A field's label can switch based on another field (altLabelWhen) — e.g. an
  // education end date becomes "Verwachte einddatum" when "Nog in opleiding" is on.
  const label = (f.altLabelWhen && values?.[f.altLabelWhen]) ? f.altLabel : f.label
  const labelText = typeof label === 'string' ? label : undefined
  if (f.checkbox) return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {f.label}
    </label>
  )
  if (f.textarea) return <TextArea placeholder={labelText} value={value as string | undefined} onChange={onChange} />
  if (f.date)     return <DateField placeholder={labelText} value={value as string | undefined} onChange={onChange} />
  if (f.options)  return (
    <select value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}>
      <option value="">{label}</option>
      {f.options.map(o => {
        const val = typeof o === 'string' ? o : o.value
        const lab = typeof o === 'string' ? o : (o.label ?? o.value)
        return <option key={val} value={val}>{lab}</option>
      })}
    </select>
  )
  return <TextField placeholder={labelText} value={value as string | undefined} onChange={onChange} type={f.type} />
}

// `initial` (optional) prefills the fields → same form for adding and editing.
export default function AddForm({ fields, onSave, onCancel, initial }: {
  fields: FieldDef[]; onSave: (values: FormValues) => void; onCancel: () => void; initial?: FormValues
}) {
  const { t } = useTranslation('common')
  const [values, setValues] = useState<FormValues>(() => ({ ...Object.fromEntries(fields.map(f => [f.key, ''])), ...(initial ?? {}) }))
  const set = (k: string, v: string | boolean) => setValues(p => ({ ...p, [k]: v }))
  const iconBtn: CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer' }

  const rows: ReactNode[] = []
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const next = fields[i + 1]
    if ((f.half && next?.half) || f.separator) {
      rows.push(
        <div key={f.key} style={f.separator
          ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }
          : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FieldInput f={f}    value={values[f.key]}    onChange={v => set(f.key, v)} values={values} />
          {f.separator && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('to')}</span>}
          {next && <FieldInput f={next} value={values[next.key]} onChange={v => set(next.key, v)} values={values} />}
        </div>
      )
      i++
    } else {
      rows.push(<FieldInput key={f.key} f={f} value={values[f.key]} onChange={v => set(f.key, v)} values={values} />)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10,
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button onClick={() => onSave(values)} title={t('save')}
          style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
          <Save size={14} />
        </button>
        <button onClick={onCancel} title={t('cancel')}
          style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
