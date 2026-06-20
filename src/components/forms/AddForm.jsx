/**
 * AddForm — schema-driven inline "add a record" form.
 *
 * Drives every "+ Toevoegen" panel in the candidate drawer (experience, education,
 * languages, certifications, skills, placements). A field is described once and
 * rendered by type; `half` pairs two fields on one row, `separator` puts a "tot"
 * label between a start/end pair.
 *
 * field: { key, label, type?, date?, textarea?, half?, separator? }
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, X } from 'lucide-react'
import { TextField, TextArea, DateField } from './fields'

function FieldInput({ f, value, onChange, values }) {
  // A field's label can switch based on another field (altLabelWhen) — e.g. an
  // education end date becomes "Verwachte einddatum" when "Nog in opleiding" is on.
  const label = (f.altLabelWhen && values?.[f.altLabelWhen]) ? f.altLabel : f.label
  if (f.checkbox) return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ cursor: 'pointer' }} />
      {f.label}
    </label>
  )
  if (f.textarea) return <TextArea placeholder={label} value={value} onChange={onChange} />
  if (f.date)     return <DateField placeholder={label} value={value} onChange={onChange} />
  if (f.options)  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}>
      <option value="">{label}</option>
      {f.options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  )
  return <TextField placeholder={label} value={value} onChange={onChange} type={f.type} />
}

// `initial` (optioneel) prefilt de velden → zelfde formulier voor toevoegen én bewerken.
export default function AddForm({ fields, onSave, onCancel, initial }) {
  const { t } = useTranslation('common')
  const [values, setValues] = useState(() => ({ ...Object.fromEntries(fields.map(f => [f.key, ''])), ...(initial ?? {}) }))
  const set = (k, v) => setValues(p => ({ ...p, [k]: v }))
  const iconBtn = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, cursor: 'pointer' }

  const rows = []
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
          <FieldInput f={next} value={values[next.key]} onChange={v => set(next.key, v)} values={values} />
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
