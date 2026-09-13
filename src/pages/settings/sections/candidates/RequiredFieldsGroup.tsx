/**
 * RequiredFieldsGroup — one collapsible block of BUILT-IN candidate fields as a
 * field × phase toggle matrix. Keeps the table shape the customer editor already uses
 * (CustomerPhaseRequiredFieldsMatrix) so both required-fields screens read identically;
 * the only addition is the collapsible shell, which the ~30-field candidate catalog needs.
 *
 * Purely presentational: membership and persistence stay in the container, so this file
 * has no knowledge of the settings blob (§3 container/presentational split).
 */
import { useTranslation } from 'react-i18next'
import { RequiredFieldsMatrixTable } from '@/pages/settings/components/RequiredFieldsMatrixTable'
import CollapsibleFieldsBlock from './CollapsibleFieldsBlock'
import type { CandidateRequiredFieldGroup } from './requiredFieldsCatalog'

/** One phase column, narrowed from the tenant lookup item. */
export interface PhaseColumn { value: string; label: string }

// One collapsible field×phase matrix block; purely presentational.
export default function RequiredFieldsGroup({ group, phases, isRequired, onToggle, open, onOpenToggle, disabled }: {
  group: CandidateRequiredFieldGroup
  phases: PhaseColumn[]
  isRequired: (phase: string, field: string) => boolean
  onToggle: (phase: string, field: string) => void
  open: boolean
  onOpenToggle: () => void
  // REQFIELDS-TOGGLE-RACE-1: inert until GET /settings has resolved.
  disabled?: boolean
}) {
  const { t } = useTranslation(['settings', 'candidates'])

  // Counter semantics: a field counts once when it is required in ANY phase, so the
  // header reads as "how much of this block is in play" regardless of phase count.
  const requiredCount = group.fields.filter(f => phases.some(p => isRequired(p.value, f.key))).length

  return (
    <CollapsibleFieldsBlock title={t(group.titleKey)} requiredCount={requiredCount} total={group.fields.length}
      open={open} onToggle={onOpenToggle}>
      <div style={{ overflowX: 'auto' }}>
        {/* Toggle, never a checkbox (Danny 28-07: "GEEN VINKJES MAAR TOGGLES!!!"). */}
        <RequiredFieldsMatrixTable fields={group.fields} phases={phases} isRequired={isRequired} onToggle={onToggle} disabled={disabled} />
      </div>
    </CollapsibleFieldsBlock>
  )
}
