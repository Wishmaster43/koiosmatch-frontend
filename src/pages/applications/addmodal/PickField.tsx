/**
 * PickField — label + shared searchable single-select, moved verbatim out of
 * PageAddApplicationModal (SIZE-TRIGGER-1) so the modal stays a thin container.
 */
import { useId } from 'react'
import type { ComponentType, ReactNode, CSSProperties } from 'react'
import CreatableSelectJs from '@/components/ui/CreatableSelect'
import { ApplicationFieldRow } from './ApplicationFieldRow'

export type AnyProps = Record<string, unknown>
const CreatableSelect = CreatableSelectJs as unknown as ComponentType<AnyProps>

// Field label + shared searchable single-select (CreatableSelect) — replaces the
// old inline SearchField dropdown (DUP-1). allowCreate off = pick-only. `style`
// (e.g. a 422 field-error border) merges with the base width, it never replaces it.
// S2 (Danny): comfortable menu width now that the panel is wide (mirrors
// MatchModal's pickerMenuWidth) — the shared component's 220px default
// read cramped for a full candidate/vacancy "title · client" label. `value || null`
// (measured live, S2): this form's state starts at '' (empty string, not null/
// undefined), and CreatableSelect's `value ?? placeholder` only falls through to
// the placeholder on null/undefined — '' short-circuited it, so every picker
// showed BLANK instead of the placeholder text (i.e. "Select a
// candidate/vacancy/recruiter"). Mirrors MatchModal's own
// `value={x || null}` pickers (job 17/18).
export function PickField({ label, style, value, ariaRequired, ...rest }: { label: ReactNode; style?: CSSProperties; value?: string; ariaRequired?: boolean } & AnyProps) {
  // §6: a <button> trigger cannot be labelled by a bare <div>, so the picker used to
  // announce only its value ("Piet Recruiter") with no field name. CreatableSelect
  // prefixes aria-labelledby with the label, so it now reads "Recruiter, Piet Recruiter".
  const fieldId = useId()
  // CLONE-BY-CONSTRUCTION-1: the shared ApplicationFieldRow shell, same as the
  // twin's (DrawerAddApplicationModal) phase/owner/source rows.
  return (
    // spacing="none": this row always sits inside a parent that already owns the
    // vertical gap (ownerField's own wrapper row, or the owner|phase grid — both
    // 16px gap); the row shell's own 14px margin would double up (verifier finding).
    <ApplicationFieldRow fieldId={fieldId} label={label} spacing="none">
      {/* REQUIRED-A11Y-4: forward the required-ness to CreatableSelect's own
          'aria-required' prop, which already places it on the trigger button. */}
      <CreatableSelect allowCreate={false} menuWidth={320} aria-labelledby={`${fieldId}-label`} aria-required={ariaRequired || undefined}
        value={value || null} style={{ width: '100%', ...style }} {...rest} />
    </ApplicationFieldRow>
  )
}
