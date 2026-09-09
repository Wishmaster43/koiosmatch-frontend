/**
 * EntityStatusChip — generic status chip for any entity (candidate, customer, …)
 * that renders either a coloured chip from a tenant lookup or a dash in the
 * entry phase. Both CandidateStatusChip and CustomerStatusChip use this under
 * the hood, passing their own lookup functions and entry-phase detection.
 *
 * The generic takes statusMeta (lookup function) and isEntryPhase (computed locally
 * by the consumer) so each entity's specific entry-phase rule stays in its own file;
 * the shared rendering logic lives here.
 */
import SoftChip from './SoftChip'
import StatusChipFallback from './StatusChipFallback'
import { NEUTRAL_AVATAR } from './Avatar'

interface EntityStatusChipProps {
  /** Status slug to look up, or null/undefined to show the fallback/dash. */
  status?: string | null
  /** Whether the entity is in its entry phase (suppress the status chip). */
  isEntryPhase: boolean
  /** Tenant lookup function: returns {label, color} for a status slug. */
  statusMeta: (slug: string) => { label: string; color?: string }
  /** Plain text instead of a coloured chip (table colour-toggle off). */
  plain?: boolean
  /** Pre-resolved label/colour for resources without the slug yet. Used ONLY
   *  when no `status` slug is given. Defaults to neutral grey. */
  fallbackLabel?: string | null
  fallbackColor?: string | null
  /** Fully-rounded pill corners — forwarded to SoftChip. */
  round?: boolean
}

// Generic entity status chip: render either the fallback dash or a coloured chip
// from the tenant lookup, never both.
export default function EntityStatusChip({
  status,
  isEntryPhase,
  statusMeta,
  plain = false,
  fallbackLabel,
  fallbackColor,
  round = false,
}: EntityStatusChipProps) {
  // No slug or entry phase: show the fallback dash or pre-resolved chip.
  if (!status || isEntryPhase) {
    return (
      <StatusChipFallback
        status={status}
        isEntryPhase={isEntryPhase}
        fallbackLabel={fallbackLabel}
        fallbackColor={fallbackColor || NEUTRAL_AVATAR}
        plain={plain}
        round={round}
      />
    )
  }

  // Status slug present and not entry phase: use the tenant lookup.
  const m = statusMeta(status)
  if (plain) return <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{m.label}</span>
  return <SoftChip label={m.label} color={m.color} round={round} />
}
