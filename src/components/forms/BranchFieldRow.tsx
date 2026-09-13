import type { TFunction } from 'i18next'
import { FieldRow } from './fields'
import CreatableSelect from '@/components/ui/CreatableSelect'

interface Option { value: string; label: string }

interface Props {
  /** The caller's own `t` (its own i18n namespace) — used to default label/clearLabel/placeholder below. */
  t: TFunction
  branchId: string
  onBranchChange: (v: string) => void
  branchOptions: Option[]
  /** The field label — defaults to `t('modal.fields.branch')`, override for a different call site. */
  label?: string
  /** The clear-icon's accessible label — defaults to the same string as `label`. */
  clearLabel?: string
  /** The placeholder shown when no branch is picked yet — defaults to `t('common:select')`. */
  placeholder?: string
}

/**
 * BranchFieldRow — the shared "Vestiging" (tenant branch) field row: a
 * searchable, clearable CreatableSelect wrapped in the canon FieldRow (clone:
 * OpportunityGeneralCard + PlacementCard). Both consumers keep their own
 * domain-naming comment at the call site (K2 / NAMING NOTE punt 13) since this
 * component only carries the shared markup, not the "why". label/clearLabel/
 * placeholder default from the caller's own `t` since both existing callers
 * share the same key names — pass them explicitly for a different string.
 */
export default function BranchFieldRow({ t, label, branchId, onBranchChange, branchOptions, clearLabel, placeholder }: Props) {
  const resolvedLabel = label ?? t('modal.fields.branch')
  return (
    <FieldRow label={resolvedLabel}>
      <CreatableSelect value={branchId || null} onChange={onBranchChange} allowCreate={false}
        clearable clearLabel={clearLabel ?? resolvedLabel}
        placeholder={placeholder ?? t('common:select')} options={branchOptions} />
    </FieldRow>
  )
}
