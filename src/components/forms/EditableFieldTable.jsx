/**
 * EditableFieldTable — a key/value table that flips between read and edit mode.
 *
 * Replaces the hand-rolled editable tables in the drawer (preferences, ZZP and
 * the profile fields). Describe the rows once as a schema; the component renders
 * the right control per type and handles the draft + save/cancel cycle. Saved
 * edits stay visible locally (optimistic) until the parent persists them via onSave.
 *
 * field: { key, label, type?: 'text'|'select'|'checkbox'|'date'|'textarea',
 *          options?, prefix?, inputType? }
 *
 * Editing can be controlled by the parent (pass `editing` + `onStartEdit` +
 * `onCancel`, e.g. the drawer's global edit mode) or left internal (the default).
 */
import { useState } from 'react'
import { Edit2, Save, X } from 'lucide-react'
import { SelectField, CheckboxField, DateField } from './fields'

const compact = {
  width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6,
  border: '1px solid var(--border)', background: 'white', color: 'var(--text)',
  boxSizing: 'border-box', outline: 'none',
}
const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 16, padding: '9px 12px',
  borderBottom: '1px solid var(--border)', background: 'var(--surface)',
}

function EditPencil({ onClick, style }) {
  return (
    <button onClick={onClick} title="Bewerken" style={{ background: 'none', border: 'none',
      cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', ...style }}>
      <Edit2 size={13} />
    </button>
  )
}

export default function EditableFieldTable({
  title, fields, value = {}, onSave, labelWidth = 130, editButton = 'header',
  editing: editingProp, onStartEdit, onCancel,
}) {
  const controlled = editingProp !== undefined
  const [editingState, setEditingState] = useState(false)
  const editing = controlled ? editingProp : editingState

  // `saved` holds the currently shown values; `form` is the in-progress draft.
  // The draft is seeded from `saved` the moment we enter edit mode — done by
  // adjusting state during render (React's recommended pattern, no extra effect).
  const [saved, setSaved] = useState(value)
  const [form, setForm] = useState(value)
  const [wasEditing, setWasEditing] = useState(editing)
  if (editing && !wasEditing) { setForm(saved); setWasEditing(true) }
  else if (!editing && wasEditing) setWasEditing(false)
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const startEdit = () => (controlled ? onStartEdit?.() : setEditingState(true))
  const cancel    = () => { setForm(saved); controlled ? onCancel?.() : setEditingState(false) }
  const iconBtn = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
  // In-place save (diskette) + cancel (✕), same spot as the pencil.
  const editControls = () => (
    <div style={{ display: 'flex', gap: 4 }}>
      <button onClick={save} title="Opslaan" style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
      <button onClick={cancel} title="Annuleren" style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
    </div>
  )
  const save      = () => { setSaved(form); onSave?.(form); if (!controlled) setEditingState(false) }

  const renderControl = (f) => {
    const v = form[f.key]
    if (f.type === 'checkbox') return <CheckboxField checked={v} onChange={val => setF(f.key, val)} />
    if (f.type === 'select')   return <SelectField value={v} onChange={val => setF(f.key, val)} options={f.options} placeholder="Selecteer" style={compact} />
    if (f.type === 'date')     return <DateField value={v} onChange={val => setF(f.key, val)} style={compact} />
    if (f.type === 'textarea') return <textarea value={v ?? ''} onChange={e => setF(f.key, e.target.value)} rows={3} style={{ ...compact, resize: 'vertical' }} />
    return <input value={v ?? ''} type={f.inputType} onChange={e => setF(f.key, e.target.value)} style={compact} />
  }

  const renderValue = (f) => {
    const v = saved[f.key]
    if (f.type === 'checkbox') return <CheckboxField checked={v} disabled onChange={() => {}} />
    return <span style={{ fontSize: 12, color: 'var(--text)' }}>{f.prefix ? `${f.prefix} ` : ''}{v || '-'}</span>
  }

  return (
    <div>
      {editButton === 'header' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          {editing ? editControls() : <EditPencil onClick={startEdit} />}
        </div>
      )}

      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16, position: 'relative' }}>
        {editButton === 'inside' && (
          <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
            {editing ? editControls() : <EditPencil onClick={startEdit} />}
          </div>
        )}
        {fields.map((f, i) => {
          const last = i === fields.length - 1
          if (f.type === 'textarea') {
            return (
              <div key={f.key} style={{ padding: '9px 12px', background: 'var(--surface)', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{f.label}</span>
                {editing ? renderControl(f) : renderValue(f)}
              </div>
            )
          }
          return (
            <div key={f.key} style={{ ...rowStyle, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', width: labelWidth, flexShrink: 0 }}>{f.label}</span>
              {editing
                ? <div style={{ flex: 1, minWidth: 0 }}>{renderControl(f)}</div>
                : renderValue(f)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
