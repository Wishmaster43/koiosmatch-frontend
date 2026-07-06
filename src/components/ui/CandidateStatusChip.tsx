/**
 * CandidateStatusChip — THE chip for a candidate's deployability status, wherever
 * a candidate is referenced (candidate table, drawers, call lists, …). Resolves
 * label + colour from the tenant lookup (LookupsContext) and applies the model-v2
 * rule in ONE place: no status, or a record still in the ENTRY phase (a Lead is
 * not deployable — Danny 2026-06-29), renders a dash instead of a chip.
 */
import { useLookups } from '@/context/LookupsContext'
import SoftChip from './SoftChip'

interface CandidateStatusChipProps {
  status?: string | null
  /** Candidate lifecycle phase; the entry phase suppresses the chip. */
  phase?: string | null
  /** Plain text instead of a coloured chip (table colour-toggle off). */
  plain?: boolean
}

export default function CandidateStatusChip({ status, phase, plain = false }: CandidateStatusChipProps) {
  const { statusMeta, phases } = useLookups() as unknown as {
    statusMeta: (v: string) => { label: string; color: string }
    phases: Array<{ value: string }>
  }
  if (!status || (phase != null && phase === phases[0]?.value)) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }
  const m = statusMeta(status)
  if (plain) return <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{m.label}</span>
  return <SoftChip label={m.label} color={m.color} />
}
