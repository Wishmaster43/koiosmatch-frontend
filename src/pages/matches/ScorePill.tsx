/**
 * ScorePill — a match score rendered as a soft-coloured percentage
 * (green ≥75, amber ≥50, red below). One source, reused by the table cell and
 * the drawer header/overview so the colour thresholds never drift (§4).
 */

// Pick the semantic colour token for a score band.
function scoreColor(value: number): string {
  return value >= 75 ? 'var(--color-success)' : value >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
}

export default function ScorePill({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <span style={{ fontWeight: 600, color: scoreColor(value) }}>{value}%</span>
}
