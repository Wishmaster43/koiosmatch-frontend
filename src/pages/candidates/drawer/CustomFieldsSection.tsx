/**
 * CustomFieldsSection — renders tenant-defined custom field values from a
 * candidate's `customFields` map. One input per type; in-place edit (pencil →
 * save/cancel) matches the rest of the drawer's edit pattern.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { useCandidateCustomFields } from '@/lib/useCandidateCustomFields'
import type { Candidate } from '@/types/candidate'
import type { CandidateCustomFieldDef } from '@/types/candidate'

interface Props {
  c: Candidate
  onEditSave?: (patch: Record<string, unknown>) => void
}

// Format a raw value for display (boolean → yes/no, date → DD-MM-YYYY, else string).
function displayValue(def: CandidateCustomFieldDef, raw: unknown, t: (k: string) => string): string {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (def.type === 'boolean') return raw ? t('common:yes') : t('common:no')
  if (def.type === 'date' && typeof raw === 'string') {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('nl-NL')
  }
  return String(raw)
}

// Render the appropriate input for a field type.
function FieldInput({ def, value, onChange }: {
  def: CandidateCustomFieldDef
  value: unknown
  onChange: (v: unknown) => void
}) {
  const inputStyle: CSSProperties = {
    width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box',
  }
  if (def.type === 'boolean') return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
    </label>
  )
  if (def.type === 'select') return (
    <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">—</option>
      {(def.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  )
  if (def.type === 'textarea') return (
    <textarea value={String(value ?? '')} onChange={e => onChange(e.target.value)}
      rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
  )
  return (
    <input
      type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')}
      onChange={e => onChange(def.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
      style={inputStyle}
    />
  )
}

const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const valueStyle: CSSProperties = { fontSize: 13, color: 'var(--text)', marginTop: 2, minHeight: 18 }

export default function CustomFieldsSection({ c, onEditSave }: Props) {
  const { t } = useTranslation('candidates')
  const { fields, loading } = useCandidateCustomFields()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState<Record<string, unknown>>({})

  if (loading || fields.length === 0) return null

  const startEdit = () => { setDraft({ ...c.customFields }); setEditing(true) }
  const cancel    = () => { setDraft({}); setEditing(false) }
  const save      = () => {
    // Send the full map so the backend can MERGE properly.
    onEditSave?.({ custom_fields: { ...c.customFields, ...draft } })
    setEditing(false)
  }

  const setVal = (key: string, v: unknown) => setDraft(p => ({ ...p, [key]: v }))

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginTop: 16 }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: '#FAFAFA', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t('drawer.customFields')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save} title={t('common:save')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12,
                       borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
              <Save size={12} /> {t('common:save')}
            </button>
            <button onClick={cancel} title={t('common:cancel')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
                       borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={12} />
            </button>
          </div>
        ) : (
          <button onClick={startEdit} title={t('common:edit')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28,
                     borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <Edit2 size={12} />
          </button>
        )}
      </div>

      {/* Fields grid */}
      <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
        {fields.map(def => (
          <div key={def.key} style={{ gridColumn: def.type === 'textarea' ? '1 / -1' : undefined }}>
            <div style={labelStyle}>{def.label}</div>
            {editing ? (
              <FieldInput def={def} value={draft[def.key] ?? c.customFields?.[def.key]} onChange={v => setVal(def.key, v)} />
            ) : (
              <div style={valueStyle}>{displayValue(def, c.customFields?.[def.key], t)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
