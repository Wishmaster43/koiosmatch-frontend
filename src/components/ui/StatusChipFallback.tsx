/**
 * StatusChipFallback — Shared fallback + entry-phase rendering logic for status chips.
 * Extracted from CandidateStatusChip and CustomerStatusChip (both had identical
 * fallback paths; only the entry-phase detection differed). The consumer renders it ONLY
 * when there is no status slug or the record sits in its entry phase; a present slug
 * goes through the consumer's own tenant lookup.
 */
import type { ReactNode } from 'react'
import SoftChip from './SoftChip'

interface StatusChipFallbackProps {
  /** The status slug (optional; if missing, render fallback or dash). */
  status?: string | null
  /** Whether the record is in its lifecycle's entry phase (no chip rendered). */
  isEntryPhase?: boolean
  /** Pre-resolved label when status slug is missing. */
  fallbackLabel?: string | null
  /** Pre-resolved color for the fallback chip (required when fallbackLabel is present). */
  fallbackColor: string
  /** Plain text instead of a coloured chip. */
  plain?: boolean
  /** Fully-rounded pill corners. */
  round?: boolean
}

// Entry phase → dash; no slug → pre-resolved fallback chip/plain text, or a dash without one.
export default function StatusChipFallback({
  status,
  isEntryPhase = false,
  fallbackLabel,
  fallbackColor,
  plain = false,
  round = false,
}: StatusChipFallbackProps): ReactNode {
  // Entry phase always renders a dash (takes precedence over status).
  if (isEntryPhase) {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>
  }

  // No status slug: render fallback or dash.
  if (!status) {
    if (!fallbackLabel) return <span style={{ color: 'var(--text-muted)' }}>—</span>
    if (plain) return <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{fallbackLabel}</span>
    return <SoftChip label={fallbackLabel} color={fallbackColor} round={round} />
  }

  return null
}
