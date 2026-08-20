import { tintBg, tintBorder, chipInk } from '@/lib/tint'

/**
 * ScorePill — the ONE compact match-score chip (both match-explorer tabs).
 * Thresholds mirror MatchScoreBlock's ring (≥75 success / ≥50 warning / else
 * danger); §4 soft-tint via lib/tint, JetBrains Mono numbers. Extracted 23-07:
 * two agents delivered identical local copies in the same wave — one source now.
 * Ink via chipInk — the raw colour on its own tint reads 2.4-3.0:1, AA fail
 * (herhaal-slotaudit r3.5).
 */
export default function ScorePill({ score }: { score: number }) {
  const color = score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, flexShrink: 0,
      color: chipInk(color), background: tintBg(color),
      border: tintBorder(color),
      borderRadius: 99, padding: '1px 7px',
    }}>{Math.round(score)}%</span>
  )
}
