/**
 * CustomerStatusChip — THE chip for a customer's deployability status, wherever a
 * customer is referenced (customers table, drawers, …). Mirrors CandidateStatusChip
 * 1:1 (Danny 02-08: "Prospect heeft geen status, moet een - worden — kijk af bij
 * kandidaat"): a customer still in the ENTRY phase (Prospect — not yet a real
 * customer, mirrors "a Lead is not deployable") renders a dash instead of a chip.
 * The rule keys on the PHASE only, never on the literal status value — the backend
 * is mid-migration off a duplicate 'prospect' STATUS value (COORDINATION-LOG
 * 2026-08-02), so a customer could in theory still carry a stray status value
 * alongside phase 'prospect'; this component ignores that and never special-cases
 * the string "prospect".
 *
 * DELIBERATE IMPROVEMENT over CandidateStatusChip: that component finds the entry
 * phase with `phases[0]?.value` — the FIRST array element, an ordering dependency
 * (reordering the phase lookup in Settings silently reattaches the rule to the
 * wrong phase). The customer phase lookup already carries an `is_default` FLAG for
 * exactly this ("the phase a new customer starts in" — useCustomerPhases.ts), so
 * this component uses THAT instead of a position. The candidate-side array-index
 * dependency is a real defect, reported separately rather than fixed here (out of
 * this lane's scope).
 */
import { useCustomerPhases } from '@/lib/useCustomerPhases'
import { useCustomerLookups } from '@/lib/useCustomerLookups'
import EntityStatusChip from './EntityStatusChip'

interface CustomerStatusChipProps {
  status?: string | null
  /** Customer lifecycle phase; the entry (default) phase suppresses the chip. */
  phase?: string | null
  /** Plain text instead of a coloured chip (table colour-toggle off). */
  plain?: boolean
  /** Pre-resolved label/colour for referencing resources that expose only the
   *  backend-resolved status, not the slug. Used ONLY when no `status` slug is
   *  given — mirrors CandidateStatusChip's identical fallback path. */
  fallbackLabel?: string | null
  fallbackColor?: string | null
  /** Fully-rounded pill corners (status/phase axes read as ROUND) — forwarded to SoftChip. */
  round?: boolean
}

// The customer deployability chip; a customer still
// in the flagged entry phase renders a dash instead of a chip.
export default function CustomerStatusChip({ status, phase, plain = false, fallbackLabel, fallbackColor, round = false }: CustomerStatusChipProps) {
  const { phases } = useCustomerPhases()
  const { statusMeta } = useCustomerLookups()
  // Entry phase = the FLAGGED default phase (is_default), never an array position —
  // see the docblock above for why this deliberately diverges from the candidate.
  const entryPhaseValue = phases.find(p => p.isDefault)?.value
  const isEntryPhase = phase != null && entryPhaseValue != null && phase === entryPhaseValue

  // Delegate to the generic EntityStatusChip with customer-specific lookup and entry-phase rule.
  return (
    <EntityStatusChip
      status={status}
      isEntryPhase={isEntryPhase}
      statusMeta={statusMeta}
      plain={plain}
      fallbackLabel={fallbackLabel}
      fallbackColor={fallbackColor}
      round={round}
    />
  )
}
