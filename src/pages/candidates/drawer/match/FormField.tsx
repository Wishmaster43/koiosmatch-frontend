/**
 * FormField (F) — a labelled field wrapper shared by every section of the
 * match form. LABEL-LEFT (Danny 13-08, P33 canon): the label sits LEFT at the
 * shared CANON_LABEL_WIDTH (fieldRowCanon, mirrors PlanIntakeModal's own
 * labelLeftRow) and the field takes the rest of the row width — replaces the
 * old label-ABOVE-field stack that made the form read as one long strip.
 * Optional `error` shows the shared required-field message (the 422 field
 * mapping in useMatchForm sets these booleans). Split out of MatchModal.tsx
 * (audit R1 item 1, MUST-SPLIT).
 *
 * A11Y FIX (control round, MODAL34-REPAIR): the label used to be a bare <div>
 * with no association to its picker/input — a CreatableSelect trigger is a
 * <button> (not labelable via a native <label for>), so its accessible name
 * was whatever placeholder text happened to be showing, not the shortened
 * 'Soort'/'CAO' label. `useId` gives the label a stable id and hands it back
 * as `labelId`, so every caller can wire `aria-labelledby` down into its own
 * picker — same recipe PaginationBar already uses to name its SelectMenu.
 */
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { labelLeftRow, rowLabel, rowField, errMsg } from './styles'

export function FormField({ label, error, children, labelId: labelIdProp }: {
  label: string
  error?: boolean
  children: React.ReactNode | ((labelId: string) => React.ReactNode)
  /** Optional caller-supplied id — omit to let this component generate its own. */
  labelId?: string
}) {
  const { t } = useTranslation('common')
  const generatedId = useId()
  const labelId = labelIdProp ?? generatedId
  return (
    <div style={labelLeftRow}>
      <span id={labelId} style={rowLabel}>{label}</span>
      <div style={rowField}>
        {typeof children === 'function' ? children(labelId) : children}
        {error && <div style={errMsg}>{t('required')}</div>}
      </div>
    </div>
  )
}
