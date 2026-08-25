/**
 * CustomFieldsTab — the ONE shared "Extra" drawer tab (§3A(f)): renders one entity's
 * active tenant-defined custom fields with in-place edit, so a new entity never
 * builds its own custom-fields UI. See the component docblock below for the
 * candidates/vacancies exception (they keep their own pre-existing tabs).
 */
import { useState, useId } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Edit2, Save, X } from 'lucide-react'
import { useCustomFields } from '@/lib/useCustomFields'
import type { CustomFieldDef, CustomFieldEntityType } from '@/lib/useCustomFields'
import { useDateFormat } from '@/lib/datetime'
import RichTextEditor from '@/components/ui/RichTextEditor'
import SafeHtml from '@/components/ui/SafeHtml'
// G34: the house searchable dropdown replaces the native <select> field type.
import CreatableSelect from '@/components/ui/CreatableSelect'
// Job 45 / Danny 22-07 point 12: the SHARED titled-card frame — this tab is reused
// across all 11 entity drawers, so both the bordered frame AND the uppercase group
// title use the generic ui/SectionCard (never a candidate-only constants file),
// mirroring how vacancies' DetailsTab card() and the candidate ProfileTab's field
// groups (Persoonlijk/Contact) are boxed. The simple-fields grid used to float with
// no title above it — that read as out of tone next to those sibling cards.
import SectionCard, { sectionBlock } from '@/components/ui/SectionCard'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import Button from '@/components/ui/Button'
import { GroupLabel } from '@/components/ui/typography'

// Canon field style (G33/fieldMetrics) — was its own padding-6/font-12/radius-6 copy.
const inputStyle: CSSProperties = fieldInputStyle

// Render one value read-only (boolean → yes/no, date → locale date, else string).
function display(def: CustomFieldDef, raw: unknown, t: (k: string) => string, formatDate: (v: string) => string): string {
  if (raw == null || raw === '') return '—'
  if (def.type === 'boolean') return raw ? t('yes') : t('no')
  if (def.type === 'date' && typeof raw === 'string') return formatDate(raw)
  return String(raw)
}

// Render the edit control for one non-textarea field type.
function FieldInput({ def, value, onChange, labelId }: { def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void; labelId?: string }) {
  if (def.type === 'boolean') return <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
  if (def.type === 'select') return (
    <CreatableSelect aria-labelledby={labelId} value={value != null && value !== '' ? String(value) : null}
      onChange={onChange} allowCreate={false} clearable placeholder="—"
      options={(def.options ?? []).map(o => ({ value: o, label: o }))} style={inputStyle} />
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
        <GroupLabel as="span" style={{ letterSpacing: '0.04em' }}>{def.label}</GroupLabel>
        {editing ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button variant="primary" size="sm" iconOnly onClick={save} title={t('save')} aria-label={t('save')}><Save size={12} /></Button>
            <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={t('cancel')} aria-label={t('cancel')}><X size={12} /></Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" iconOnly onClick={start} title={t('edit')} aria-label={t('edit')}><Edit2 size={12} /></Button>
        )}
      </div>
      {editing
        ? <RichTextEditor value={draft} onChange={setDraft} expanded={expanded} onToggleExpand={() => setExpanded(v => !v)} />
        : (value
            ? <div style={{ ...sectionBlock, maxHeight: 180, overflow: 'auto' }}>
                <SafeHtml html={String(value)} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }} />
              </div>
            : <div style={{ ...sectionBlock, fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>{t('empty')}</div>)}
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
  // Base id for each select-type field's label — CreatableSelect's trigger is a
  // <button>, which ignores an associated <label for> (see its own doc comment),
  // so aria-labelledby names it instead. def.key is unique per tenant def already;
  // the useId() prefix only guards against two CustomFieldsTab instances at once.
  const labelBaseId = useId()

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
        // Danny 22-07 point 12: titled SectionCard (border/surface + uppercase group
        // title) instead of a bare grid — matches the Persoonlijk/Contact-style cards
        // elsewhere in the drawer; the edit pencil sits in the card's own title row.
        <SectionCard
          title={t('customFieldsCard.title')}
          action={editing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <Button variant="primary" size="sm" iconOnly onClick={save} title={t('save')} aria-label={t('save')}><Save size={13} /></Button>
              <Button variant="secondary" size="sm" iconOnly onClick={cancel} title={t('cancel')} aria-label={t('cancel')}><X size={13} /></Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" iconOnly onClick={startEdit} title={t('edit')} aria-label={t('edit')}><Edit2 size={13} /></Button>
          )}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}
        >
          {simpleFields.map(def => {
            const labelId = `${labelBaseId}-${def.key}`
            return (
              <div key={def.key}>
                <GroupLabel id={labelId} style={{ letterSpacing: '0.04em', marginBottom: 3 }}>{def.label}</GroupLabel>
                {editing
                  ? <FieldInput def={def} value={draft[def.key] ?? values[def.key]} onChange={val => setVal(def.key, val)} labelId={labelId} />
                  : <div style={{ fontSize: 13, color: 'var(--text)', minHeight: 18 }}>{display(def, values[def.key], t, formatDate)}</div>}
              </div>
            )
          })}
        </SectionCard>
      )}
      {textFields.map(def => (
        <RichTextField key={def.key} def={def} value={values[def.key]} onSave={v => onSave({ [def.key]: v })} />
      ))}
    </div>
  )
}
