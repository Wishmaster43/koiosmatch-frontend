/**
 * CustomFieldInput — one simple-typed tenant custom field's edit control
 * (boolean/select/text/number/date). Extracted VERBATIM from
 * `components/drawer/CustomFieldsTab.tsx`'s module-private `FieldInput`
 * (ONIX N-005, lane N005-CUSTOMFIELDS-CREATE-B) so a create-modal card can
 * reuse the exact same render as the drawer's later "Extra" tab — one
 * implementation, never a second hand-rolled copy (§0.4). CustomFieldsTab
 * imports it back; its render stays byte-identical.
 */
import type { CustomFieldDef } from '@/lib/useCustomFields'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'

// Canon field style (G33/fieldMetrics) — was its own padding-6/font-12/radius-6 copy.
const inputStyle = fieldInputStyle

interface CustomFieldInputProps {
  def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void
  // CustomFieldsTab's own usage names the label id `labelId`; a FieldRow/Field
  // wrapper (RequiredCustomFieldsCard) clones `id`/`aria-labelledby`/`aria-required`
  // onto its child directly (§ field layout) — both paths are accepted here, so the
  // control forwards whichever naming its caller used onto the real input/trigger.
  labelId?: string
  id?: string
  'aria-labelledby'?: string
  'aria-required'?: boolean
  // 422 red-border flag (fields.tsx:148 recipe); default false keeps CustomFieldsTab byte-identical.
  error?: boolean
}

// Render the edit control for one non-textarea custom-field type.
export function CustomFieldInput({ def, value, onChange, labelId, id, 'aria-labelledby': ariaLabelledBy, 'aria-required': ariaRequired, error = false }: CustomFieldInputProps) {
  const labelledBy = ariaLabelledBy ?? labelId
  const errorStyle = error ? { border: '1px solid var(--color-danger)' } : {}
  if (def.type === 'boolean') return <input id={id} type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} aria-labelledby={labelledBy} aria-required={ariaRequired} />
  if (def.type === 'select') return (
    <CreatableSelect id={id} aria-labelledby={labelledBy} aria-required={ariaRequired} value={value != null && value !== '' ? String(value) : null}
      onChange={onChange} allowCreate={false} clearable placeholder="—"
      options={(def.options ?? []).map(o => ({ value: o, label: o }))} style={{ ...inputStyle, ...errorStyle }} />
  )
  return (
    <input id={id} type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      value={String(value ?? '')} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, ...errorStyle }} aria-labelledby={labelledBy} aria-required={ariaRequired} />
  )
}

export default CustomFieldInput
