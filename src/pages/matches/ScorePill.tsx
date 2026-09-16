import { useNumberFormat } from '@/lib/formatters'

/**
 * ScorePill — a match score rendered as a soft-coloured percentage
 * (green ≥75, amber ≥50, red below). One source, reused by the table cell and
 * the drawer header/overview so the colour thresholds never drift (§4).
 */

// Pick the semantic ink-twin token for a score band (§4: never the raw fill token as text).
function scoreColor(value: number): string {
  return value >= 75
    ? 'var(--color-success-text)'
    : value >= 50
      ? 'var(--color-warning-text)'
      : 'var(--color-danger-text)'
}

// Renders a match score as a colour-coded percentage (see file docblock above);
// a missing value shows a plain dash rather than a coloured zero.
export default function ScorePill({ value }: { value: number | null }) {
  const { formatPercent } = useNumberFormat()
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <span style={{ fontWeight: 600, color: scoreColor(value) }}>{formatPercent(value)}</span>
}
