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
import { TextField, TextArea, DateField, SaveCancel } from './fields'

function FieldInput({ f, value, onChange }) {
  if (f.textarea) return <TextArea placeholder={f.label} value={value} onChange={onChange} />
  if (f.date)     return <DateField placeholder={f.label} value={value} onChange={onChange} />
  return <TextField placeholder={f.label} value={value} onChange={onChange} type={f.type} />
}

export default function AddForm({ fields, onSave, onCancel }) {
  const { t } = useTranslation('common')
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, ''])))
  const set = (k, v) => setValues(p => ({ ...p, [k]: v }))

  const rows = []
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const next = fields[i + 1]
    if ((f.half && next?.half) || f.separator) {
      rows.push(
        <div key={f.key} style={f.separator
          ? { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }
          : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FieldInput f={f}    value={values[f.key]}    onChange={v => set(f.key, v)} />
          {f.separator && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('to')}</span>}
          <FieldInput f={next} value={values[next.key]} onChange={v => set(next.key, v)} />
        </div>
      )
      i++
    } else {
      rows.push(<FieldInput key={f.key} f={f} value={values[f.key]} onChange={v => set(f.key, v)} />)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10,
      background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows}
      <SaveCancel onSave={() => onSave(values)} onCancel={onCancel} />
    </div>
  )
}
