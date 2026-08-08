/**
 * CustomFieldInput — one simple-typed tenant custom field's edit control
 * (text/number/date/boolean/select), §0.3 split out of AddApplicationModal
 * (mirrors the candidate addmodal/ folder). Mirrors CustomFieldsTab's own
 * FieldInput rendering convention so the create-time "Extra" section and the
 * drawer's later Extra tab render identically. `id` ties the control to its
 * <label htmlFor> in the caller (§6 — every input needs an associated label,
 * not just a nearby, unconnected div).
 */
import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { CustomFieldDef } from '@/lib/useCustomFields'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
// G34 (Danny 08-08, §4): the house searchable dropdown replaces the native
// <select> field type — mirrors CustomFieldsTab.tsx's own FieldInput conversion.
import CreatableSelect from '@/components/ui/CreatableSelect'

// Canon field style (G33/fieldMetrics) — was its own padding-6/font-12/radius-6 copy.
const inputStyle: CSSProperties = fieldInputStyle

export default function CustomFieldInput({ id, def, value, onChange }: { id: string; def: CustomFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  // CreatableSelect's trigger is a <button> — the caller's <label htmlFor={id}>
  // still gives it click-to-focus (button IS a labelable element), but does not
  // supply the accessible NAME the way it does for a native <select> (measured
  // elsewhere in this codebase, see CreatableSelect's own doc comment) — this
  // sr-only span carries the id aria-labelledby needs, self-contained so the
  // caller (AddApplicationModal) needs no change.
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
