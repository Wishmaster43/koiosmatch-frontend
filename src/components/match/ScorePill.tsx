/**
 * ScorePill — the ONE compact match-score chip (both match-explorer tabs).
 * Thresholds mirror MatchScoreBlock's ring (≥75 success / ≥50 warning / else
 * danger); §4 soft-tint, JetBrains Mono numbers. Extracted 23-07: two agents
 * delivered identical local copies in the same wave — one source now.
 */
export default function ScorePill({ score }: { score: number }) {
  const color = score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, flexShrink: 0,
      color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      borderRadius: 99, padding: '1px 7px',
    }}>{Math.round(score)}%</span>
  )
}
