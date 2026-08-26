/**
 * OperatorSelect — the shared, backend-matching filter operator dropdown, grouped
 * Text / Number / Date&time (Make-style, FILTER-VELD-1). Used by both the
 * edge-filter modal and the in-module FiltersField so "the same filter" means
 * the same UI everywhere (§4 consistency).
 *
 * Danny 08-08 (§4): the house searchable CreatableSelect replaces the former
 * native <select>+<optgroup> — CreatableSelect has no optgroup equivalent, so
 * the three groups are flattened into one list with each option's label
 * prefixed by its group name ("Text · contains"), mirroring the same flattening
 * DocumentLinkPicker already applies to its own grouped picker. Preferred over
 * SelectMenu here specifically because this control is also used inside the
 * edge-filter modal, which is wrapped in useFocusTrap — EventCombobox's own
 * doc comment (this same directory) proved SelectMenu's document-level Escape
 * listener shares the plain <select>'s latent flaw in a trapped dialog; only
 * CreatableSelect's portalled popover truly survives it.
 */
import type { CSSProperties } from 'react'
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import CreatableSelect from '@/components/ui/CreatableSelect'
import { OPERATOR_OPTIONS, OPERATOR_GROUP_LABEL_KEYS, type OperatorGroup } from './constants'

const GROUPS: OperatorGroup[] = ['text', 'number', 'date']

// Flattens the three operator groups (text/number/date) into one labelled list for CreatableSelect (see the module doc above for why not SelectMenu/native select).
export function OperatorSelect({ value, onChange, style, ariaLabel }: {
  value?: string; onChange: (v: string) => void; style?: CSSProperties; ariaLabel?: string
}) {
  const { t } = useTranslation('workflows')
  // CreatableSelect's trigger is a <button>, which a plain aria-label cannot
  // name — a sr-only span + aria-labelledby names it instead (§4). Each
  // OperatorSelect instance (one per filter-condition row) gets its own id
  // for free since useId() is scoped per component instance.
  const labelId = useId()
  const label = ariaLabel ?? t('fields.operator')
  // Memoised: the flattened, translated option list only needs rebuilding when the active locale changes.
  const options = useMemo(() => GROUPS.flatMap(g => OPERATOR_OPTIONS.filter(op => op.group === g).map(op => ({
    value: op.value,
    label: `${t(OPERATOR_GROUP_LABEL_KEYS[g])} · ${op.symbol ?? t(op.labelKey!)}`,
  }))), [t])
  return (
    <>
      <span id={labelId} className="sr-only">{label}</span>
      <CreatableSelect value={value ?? '='} onChange={onChange} aria-labelledby={labelId} allowCreate={false}
        options={options} menuWidth={230}
        style={{ padding: '6px 8px', fontSize: 12, ...style }} />
    </>
  )
}
