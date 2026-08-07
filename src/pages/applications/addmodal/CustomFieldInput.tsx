/**
 * CustomFieldInput — one simple-typed tenant custom field's edit control
 * (text/number/date/boolean/select), §0.3 split out of AddApplicationModal
 * (mirrors the candidate addmodal/ folder). Mirrors CustomFieldsTab's own
 * FieldInput rendering convention so the create-time "Extra" section and the
 * drawer's later Extra tab render identically. `id` ties the control to its
 * <label htmlFor> in the caller (§6 — every input needs an associated label,
 * not just a nearby, unconnected div).
 */
import type { CSSProperties } from 'react'
import type { CustomFieldDef } from '@/lib/useCustomFields'

const inputStyle: CSSProperties = { width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', boxSizing: 'border-box' }

export default function CustomFieldInput({ id, def, value, onChange }: { id: string; def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (def.type === 'boolean') return <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
  if (def.type === 'select') return (
    <select id={id} value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">—</option>
      {(def.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <input id={id} type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
  )
}
