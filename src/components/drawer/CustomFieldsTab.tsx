import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { useCustomFields } from '@/lib/useCustomFields'
import type { CustomFieldDef, CustomFieldEntityType } from '@/lib/useCustomFields'
import { useDateFormat } from '@/lib/datetime'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'

const inputStyle: CSSProperties = { width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }
const iconBtn: CSSProperties = { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer' }
const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }

// Render one value read-only (boolean → yes/no, date → locale date, else string).
function display(def: CustomFieldDef, raw: unknown, t: (k: string) => string, formatDate: (v: string) => string): string {
  if (raw == null || raw === '') return '—'
  if (def.type === 'boolean') return raw ? t('yes') : t('no')
  if (def.type === 'date' && typeof raw === 'string') return formatDate(raw)
  return String(raw)
}

// Render the edit control for one non-textarea field type.
function FieldInput({ def, value, onChange }: { def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (def.type === 'boolean') return <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
  if (def.type === 'select') return (
    <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
      <option value="">—</option>
      {(def.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  return (
    <input type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
  )
}

// One textarea-type custom field — its OWN rich-text block with an independent
// pencil → save/✕ (house rule: every free-text field is rich text, RichTextEditor +
// SafeHtml — never a bare textarea, §3A).
function RichTextField({ def, value, onSave }: { def: CustomFieldDef; value: unknown; onSave: (v: string) => void }) {
  const { t } = useTranslation('common')
  const [editing, setEditing]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft]       = useState(String(value ?? ''))

  const start  = () => { setDraft(String(value ?? '')); setEditing(true) }
  const save   = () => { onSave(draft); setEditing(false) }
  const cancel = () => { setDraft(String(value ?? '')); setEditing(false) }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={labelStyle}>{def.label}</span>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={save} title={t('save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={12} /></button>
            <button onClick={cancel} title={t('cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={12} /></button>
          </div>
        ) : (
          <button onClick={start} title={t('edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={12} /></button>
        )}
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={setDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
        : (value
            ? <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', maxHeight: 180, overflow: 'auto' }}>
                <SafeHtml html={String(value)} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            : <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('empty')}</div>)}
    </div>
  )
}

interface Props {
  // The /custom-fields entity_type this tab renders (§3A(f) — the Extra tab).
  entityType: CustomFieldEntityType
  // Current field values, keyed by the field's slug (the entity's own `custom_fields` map).
  values: Record<string, unknown>
  // Persist a partial patch of { key: value } — the caller merges into the entity's
  // full custom_fields map and PATCHes through its own existing update path.
  onSave: (patch: Record<string, unknown>) => void
}

/**
 * CustomFieldsTab — the ONE shared "Extra" drawer tab (§3A(f)): renders one
 * entity's active tenant-defined custom fields + current values, in-place edit
 * (pencil → save/✕) for the simple types, and one independent rich-text block per
 * textarea field. Every NEW entity wires its Extra tab through this one component
 * (applications, matches, vacancies-already-had-one, tasks, opportunities, outreach
 * campaigns, customers + sub-entities); candidates/vacancies keep their own
 * pre-existing tab components (CustomFieldsSection / vacancies/drawer/ExtraTab) —
 * see those files' docblocks for why they were left as-is.
 */
export default function CustomFieldsTab({ entityType, values, onSave }: Props) {
  const { t } = useTranslation('common')
  const { formatDate } = useDateFormat()
  const { fields, loading } = useCustomFields(entityType)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<Record<string, unknown>>({})

  // The drawer only mounts this tab once ≥1 active def exists; still, guard the
  // brief window before the defs load or a stale gate (never render half a grid).
  if (loading || fields.length === 0) return null

  const simpleFields = fields.filter(f => f.type !== 'textarea')
  const textFields   = fields.filter(f => f.type === 'textarea')

  const startEdit = () => { setDraft({ ...values }); setEditing(true) }
  const cancel    = () => { setDraft({}); setEditing(false) }
  const save      = () => { onSave({ ...draft }); setEditing(false) }
  const setVal    = (key: string, val: unknown) => setDraft(p => ({ ...p, [key]: val }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {simpleFields.length > 0 && (
        <div>
          {/* No repeated "Extra" title — it would duplicate the tab label (§3A). */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            {editing ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={save} title={t('save')} style={{ ...iconBtn, background: 'var(--color-primary)', color: '#fff', border: 'none' }}><Save size={13} /></button>
                <button onClick={cancel} title={t('cancel')} style={{ ...iconBtn, background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><X size={13} /></button>
              </div>
            ) : (
              <button onClick={startEdit} title={t('edit')} style={{ ...iconBtn, background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)' }}><Edit2 size={13} /></button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            {simpleFields.map(def => (
              <div key={def.key}>
                <div style={labelStyle}>{def.label}</div>
                {editing
                  ? <FieldInput def={def} value={draft[def.key] ?? values[def.key]} onChange={val => setVal(def.key, val)} />
                  : <div style={{ fontSize: 13, color: 'var(--text)', minHeight: 18 }}>{display(def, values[def.key], t, formatDate)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {textFields.map(def => (
        <RichTextField key={def.key} def={def} value={values[def.key]} onSave={v => onSave({ [def.key]: v })} />
      ))}
    </div>
  )
}
