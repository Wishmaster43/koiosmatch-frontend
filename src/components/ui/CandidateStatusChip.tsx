/**
 * CandidateStatusChip — THE chip for a candidate's deployability status, wherever
 * a candidate is referenced (candidate table, drawers, call lists, …). Resolves
 * label + colour from the tenant lookup (LookupsContext) and applies the model-v2
 * rule in ONE place: no status, or a record still in the ENTRY phase (a Lead is
 * not deployable — Danny 2026-06-29), renders a dash instead of a chip.
 */
import { useLookups } from '@/context/LookupsContext'
import EntityStatusChip from './EntityStatusChip'

interface CandidateStatusChipProps {
  status?: string | null
  /** Candidate lifecycle phase; the entry phase suppresses the chip. */
  phase?: string | null
  /** Plain text instead of a coloured chip (table colour-toggle off). */
  plain?: boolean
  /** Pre-resolved label/colour for referencing resources (applications/outreach/
   *  tasks) that expose only the backend-resolved status, not the slug. Used ONLY
   *  when no `status` slug is given — routes those through this one component so the
   *  chip upgrades to the full lookup rules automatically once BE adds the slug. */
  fallbackLabel?: string | null
  fallbackColor?: string | null
  /** Fully-rounded pill corners (Danny 2026-07-14: status/phase axes read as ROUND,
   *  qualification chips stay square) — forwarded to the underlying SoftChip. */
  round?: boolean
}

// House status/phase chip: resolves a slug via the tenant lookup when given one,
// else falls back to a pre-resolved label/colour for resources without the slug yet (see the prop doc above).
export default function CandidateStatusChip({ status, phase, plain = false, fallbackLabel, fallbackColor, round = false }: CandidateStatusChipProps) {
  const { statusMeta, phases } = useLookups() as unknown as {
    statusMeta: (v: string) => { label: string; color: string }
    phases: Array<{ value: string }>
  }
  // Detect entry phase (first in the lookup array).
  const isEntryPhase = phase != null && phase === phases[0]?.value

  // Delegate to the generic EntityStatusChip with candidate-specific lookup and entry-phase rule.
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
