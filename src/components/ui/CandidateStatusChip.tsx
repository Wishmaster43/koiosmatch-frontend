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
  /** Pre-resolved label/colour for referencing resources (applications/outreach/
   *  tasks) that expose only the backend-resolved status, not the slug. Used ONLY
   *  when no `status` slug is given — routes those through this one component so the
   *  chip upgrades to the full lookup rules automatically once BE adds the slug. */
  fallbackLabel?: string | null
  fallbackColor?: string | null
}

export default function CandidateStatusChip({ status, phase, plain = false, fallbackLabel, fallbackColor }: CandidateStatusChipProps) {
  const { statusMeta, phases } = useLookups() as unknown as {
    statusMeta: (v: string) => { label: string; color: string }
    phases: Array<{ value: string }>
  }
  // No slug: render the pre-resolved fallback (one component everywhere) — a Lead
  // still shows nothing, and a dash when there's no status at all.
  if (!status) {
    if (phase != null && phase === phases[0]?.value) return <span style={{ color: 'var(--text-muted)' }}>—</span>
    if (!fallbackLabel) return <span style={{ color: 'var(--text-muted)' }}>—</span>
    if (plain) return <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{fallbackLabel}</span>
    return <SoftChip label={fallbackLabel} color={fallbackColor || '#9CA3AF'} />
  }
  // Slug present: apply the model-v2 rule — a Lead is not deployable, so no chip.
  if (phase != null && phase === phases[0]?.value) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }
  const m = statusMeta(status)
  if (plain) return <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{m.label}</span>
  return <SoftChip label={m.label} color={m.color} />
}
