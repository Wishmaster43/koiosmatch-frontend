/**
 * OperatorSelect — the shared, backend-matching filter operator dropdown, grouped
 * Tekst / Getal / Datum&tijd (Make-style, FILTER-VELD-1). One native <select>
 * with an <optgroup> per group — keeps it fully keyboard/screen-reader operable
 * without a bespoke dropdown. Used by both the edge-filter modal and the in-module
 * FiltersField so "the same filter" means the same UI everywhere (§4 consistency).
 */
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { OPERATOR_OPTIONS, OPERATOR_GROUP_LABEL_KEYS, type OperatorGroup } from './constants'

const GROUPS: OperatorGroup[] = ['text', 'number', 'date']

export function OperatorSelect({ value, onChange, style, ariaLabel }: {
  value?: string; onChange: (v: string) => void; style?: CSSProperties; ariaLabel?: string
}) {
  const { t } = useTranslation('workflows')
  return (
    <select value={value ?? '='} onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel ?? t('fields.operator')}
      style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, outline: 'none', background: 'var(--surface)', cursor: 'pointer', ...style }}>
      {GROUPS.map(g => (
        <optgroup key={g} label={t(OPERATOR_GROUP_LABEL_KEYS[g])}>
          {OPERATOR_OPTIONS.filter(op => op.group === g).map(op => (
            <option key={op.value} value={op.value}>{op.symbol ?? t(op.labelKey!)}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
