/**
 * RequiredFieldsGroup — one collapsible block of candidate fields as a field × phase
 * toggle matrix, now driven by the field inventory (VERPLICHTE-VELDEN-INVENTARIS-1):
 * a group's fields carry `requirable`/`reason` from `GET /settings/field-inventory`, so
 * a `requirable:false` field (relation-backed, financial-without-permission-handled-
 * upstream, etc.) renders as a disabled, reasoned row instead of a live toggle — Danny
 * wants to SEE what he cannot require and why, never a silently missing row. Keeps the
 * table shape the customer editor already uses (CustomerPhaseRequiredFieldsMatrix) for
 * the requirable rows.
 *
 * Purely presentational: membership and persistence stay in the container, so this file
 * has no knowledge of the settings blob (§3 container/presentational split).
 *
 * Verifier fix (17-09): a non-requirable field used to render in a bespoke plain-text
 * block below the matrix — a second look for "shown but not requirable" next to the
 * shared `RequiredFieldsMatrixTable`'s own locked-row rendering (which the customer
 * screen already uses). All of a group's fields — requirable and locked alike — now go
 * through that one shared table, so both screens share one face for the concept.
 */
import { useTranslation } from 'react-i18next'
import { RequiredFieldsMatrixTable } from '@/pages/settings/components/RequiredFieldsMatrixTable'
import CollapsibleFieldsBlock from './CollapsibleFieldsBlock'

/** One phase column, narrowed from the tenant lookup item. */
export interface PhaseColumn { value: string; label: string }

/** One inventory-backed field: labelled + flagged requirable/not, with its reason. */
export interface InventoryFieldRow {
  key: string
  labelKey: string
  requirable: boolean
  reason: string | null
}

/** One inventory-backed group: id + title key + its (already permission-filtered) fields. */
export interface InventoryFieldGroup {
  id: string
  titleKey: string
  fields: InventoryFieldRow[]
}

// One collapsible field×phase matrix block; purely presentational.
export default function RequiredFieldsGroup({ group, phases, isRequired, onToggle, open, onOpenToggle, disabled }: {
  group: InventoryFieldGroup
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
  // The total is every row the block renders (locked rows included), so "0 van 10"
  // above ten locked rows is honest where "0 van 0" was not (verifier, 17-09).
  const totalCount = group.fields.length
  const requiredCount = group.fields.filter(f => f.requirable && phases.some(p => isRequired(p.value, f.key))).length

  return (
    <CollapsibleFieldsBlock title={t(group.titleKey)} requiredCount={requiredCount} total={totalCount}
      open={open} onToggle={onOpenToggle}>
      <div style={{ overflowX: 'auto' }}>
        {/* Toggle, never a checkbox (Danny 28-07: "TOGGLES, NOT CHECKBOXES!!!"). A
            requirable:false row still renders here, disabled with its reason on hover —
            the shared table's own locked-row treatment, same as the customer screen. */}
        <RequiredFieldsMatrixTable fields={group.fields} phases={phases} isRequired={isRequired} onToggle={onToggle} disabled={disabled} />
      </div>
    </CollapsibleFieldsBlock>
  )
}
