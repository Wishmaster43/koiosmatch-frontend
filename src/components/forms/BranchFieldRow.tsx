import { FieldRow } from './fields'
import CreatableSelect from '@/components/ui/CreatableSelect'

interface Option { value: string; label: string }

interface Props {
  /** The field label — the caller's own translated string (its own i18n namespace). */
  label: string
  branchId: string
  onBranchChange: (v: string) => void
  branchOptions: Option[]
  /** The clear-icon's accessible label — the caller's own translated string. */
  clearLabel: string
  /** The placeholder shown when no branch is picked yet. */
  placeholder: string
}

/**
 * BranchFieldRow — the shared "Vestiging" (tenant branch) field row: a
 * searchable, clearable CreatableSelect wrapped in the canon FieldRow (clone:
 * OpportunityGeneralCard + PlacementCard). Both consumers keep their own
 * domain-naming comment at the call site (K2 / NAMING NOTE punt 13) since this
 * component only carries the shared markup, not the "why".
 */
export default function BranchFieldRow({ label, branchId, onBranchChange, branchOptions, clearLabel, placeholder }: Props) {
  return (
    <FieldRow label={label}>
      <CreatableSelect value={branchId || null} onChange={onBranchChange} allowCreate={false}
        clearable clearLabel={clearLabel}
        placeholder={placeholder} options={branchOptions} />
    </FieldRow>
  )
}
