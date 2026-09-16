/**
 * ScorePill — the ONE compact match-score chip (both match-explorer tabs).
 * Thresholds mirror MatchScoreBlock's ring (≥75 success / ≥50 warning / else
 * danger); §4 soft-tint via lib/tint, JetBrains Mono numbers. Extracted 23-07:
 * two agents delivered identical local copies in the same wave — one source now.
 * Ink via chipInk — the raw colour on its own tint reads 2.4-3.0:1, AA fail
 * (repeat closing-audit round, finding r3.5).
 */
import SoftChip from '@/components/ui/SoftChip'
import { Mono } from '@/components/ui/typography'
import { useNumberFormat } from '@/lib/formatters'
import { scoreColor } from './scoreColor'

// Compact score chip, tinted success/warning/danger by the same thresholds as MatchScoreBlock's ring.
export default function ScorePill({ score }: { score: number }) {
  const { formatPercent } = useNumberFormat()
  const color = scoreColor(score)
  return (
    <span style={{ flexShrink: 0 }}>
      <SoftChip round size={11} color={color} label={<Mono style={{ fontWeight: 600 }}>{formatPercent(Math.round(score))}</Mono>} />
    </span>
  )
}
