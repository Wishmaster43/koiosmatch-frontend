/**
 * ApplicationCustomFieldsSection — the "Extra" tenant-custom-fields block for
 * the candidate-drawer AddApplicationModal (W30, §3A(f): rendered only once
 * ≥1 active def exists). Mirrors pages/applications/addmodal/
 * CustomFieldsSection + CustomFieldInput byte-for-byte (built locally instead
 * of a cross-entity import — §2 barrel rule: applications/shared.ts does not
 * re-export those internal addmodal/ files).
 */
import { useId } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import RichTextEditor from '@/components/ui/RichTextEditor'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { GroupLabel } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import type { CustomFieldDef } from '@/lib/useCustomFields'

// Canon field style (G33/fieldMetrics) — same house look every simple input uses.
const inputStyle: CSSProperties = fieldInputStyle

// One simple-typed field's edit control (text/number/date/boolean/select) — `id`
// ties it to its <label htmlFor> in the caller below (§6, no bare unlabelled div).
function CustomFieldInput({ id, def, value, onChange }: { id: string; def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const srLabelId = useId()
  if (def.type === 'boolean') return <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
  if (def.type === 'select') return (
    <>
      <span id={srLabelId} className="sr-only">{def.label}</span>
      <CreatableSelect id={id} aria-labelledby={srLabelId}
        value={value != null && value !== '' ? String(value) : null}
        onChange={onChange} allowCreate={false} clearable placeholder="—"
        options={(def.options ?? []).map(o => ({ value: o, label: o }))} style={inputStyle} />
    </>
  )
  return (
    <input id={id} type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={inputStyle} />
  )
}

export default function ApplicationCustomFieldsSection({
  simpleCustomFields, textCustomFields, customFieldValues, setCustomField,
}: {
  simpleCustomFields: CustomFieldDef[]
  textCustomFields: CustomFieldDef[]
  customFieldValues: Record<string, unknown>
  setCustomField: (key: string, v: unknown) => void
}) {
  const { t } = useTranslation('candidates')
  return (
    <div>
      <GroupLabel style={{ letterSpacing: '0.04em', marginBottom: 8 }}>
        {t('common:customFieldsCard.title')}
      </GroupLabel>
      {simpleCustomFields.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {simpleCustomFields.map(def => {
            const inputId = `app-cf-${def.key}`
            return (
              <div key={def.key}>
                <label htmlFor={inputId} style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{def.label}</label>
                <CustomFieldInput id={inputId} def={def} value={customFieldValues[def.key]} onChange={v => setCustomField(def.key, v)} />
              </div>
            )
          })}
        </div>
      )}
      {textCustomFields.map(def => (
        <div key={def.key} style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>{def.label}</div>
          <RichTextEditor value={String(customFieldValues[def.key] ?? '')} onChange={v => setCustomField(def.key, v)} minHeight={80} />
        </div>
      ))}
    </div>
  )
}
