import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { useVacancyCustomFields } from '@/lib/useVacancyCustomFields'
import type { VacancyFieldDef } from '@/lib/useVacancyCustomFields'
import type { VacancyDetail } from '@/types/vacancy'
import type { Id } from '@/types/common'

type UpdateFn = (id: Id | undefined, patch: Record<string, unknown>) => void

const inputStyle: CSSProperties = { width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }
const iconBtn: CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }

// Render one value read-only (boolean → yes/no, date → DD-MM-YYYY, else string).
function display(def: VacancyFieldDef, raw: unknown, t: (k: string) => string): string {
  if (raw == null || raw === '') return '—'
  if (def.type === 'boolean') return raw ? t('common:yes') : t('common:no')
  if (def.type === 'date' && typeof raw === 'string') { const d = new Date(raw); return isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('nl-NL') }
  return String(raw)
}

// Render the edit control for one field type.
function FieldInput({ def, value, onChange }: { def: VacancyFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (def.type === 'boolean') return <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
  if (def.type === 'select') return (
    <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">—</option>
      {(def.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (def.type === 'textarea') return <textarea value={String(value ?? '')} onChange={e => onChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
  return <input type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'} value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
}

/**
 * ExtraTab — tenant-defined vacancy custom fields, editable in place. Only mounted
 * when definitions exist (the drawer gates the tab on the same hook). Mirrors the
 * candidate CustomFieldsSection; values persist through onUpdate → custom_fields map.
 */
export default function ExtraTab({ vacancy: v, onUpdate }: { vacancy: VacancyDetail; onUpdate?: UpdateFn }) {
  const { t } = useTranslation('vacancies')
  const { fields } = useVacancyCustomFields()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  const values = v.customFieldValues ?? {}
  const startEdit = () => { setDraft({ ...values }); setEditing(true) }
  const cancel = () => { setDraft({}); setEditing(false) }
  const save = () => { onUpdate?.(v.id, { customFieldValues: { ...values, ...draft } }); setEditing(false) }
  const setVal = (key: string, val: unknown) => setDraft(p => ({ ...p, [key]: val }))

  if (fields.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('publishing.noCustomFields')}</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{t('publishing.customFields')}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={t('common:save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
            <button onClick={cancel} title={t('common:cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
          </div>
        ) : (
          <button onClick={startEdit} title={t('common:edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
        {fields.map(def => (
          <div key={def.key} style={{ gridColumn: def.type === 'textarea' ? '1 / -1' : undefined }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{def.label}</div>
            {editing
              ? <FieldInput def={def} value={draft[def.key] ?? values[def.key]} onChange={val => setVal(def.key, val)} />
              : <div style={{ fontSize: 13, color: 'var(--text)', minHeight: 18 }}>{display(def, values[def.key], t)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
