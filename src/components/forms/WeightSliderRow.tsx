import { Mono } from '@/components/ui/typography'
import Slider from '@/components/ui/Slider'

interface Props {
  /** The dimension's translated label (e.g. t(`matching.dim.${d}`)). */
  label: string
  /** Current weight, 1..5 (the caller resolves its own default, e.g. `weights[d] ?? 3`). */
  weight: number
  /** Called with the new weight, 1..5. */
  onChange: (weight: number) => void
  /** The three slider position labels (less/balanced/very), already translated. */
  sliderLabels: [string, string, string]
  /** Accessible name for the slider (the caller's own translated dimension label). */
  ariaLabel: string
  /** The weight number's font size — the two consumers differ (11 on the add-modal
      card, 12 on the drawer tab, Canon 05-08 there) — never hardcode one value. */
  weightFontSize: number
}

/**
 * WeightSliderRow — one match-weight dimension row: label + the concrete N/5
 * weight + a 0-based Slider (stored weight is 1..5) (clone: MatchProfileCard +
 * MatchingTab). Danny 22-07: the weight shows as the clean number, never a
 * %-of-total — on a 6-way split it can't be both equal for equal sliders AND
 * total 100 (100÷6=16,66…), so relative importance shows in the slider
 * positions instead.
 */
export default function WeightSliderRow({ label, weight, onChange, sliderLabels, ariaLabel, weightFontSize }: Props) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
        <Mono style={{ fontSize: weightFontSize, fontWeight: 600, color: 'var(--text)' }}>
          {weight}/5
        </Mono>
      </div>
      <Slider value={weight - 1} max={4} step={1} onChange={(i: number) => onChange(i + 1)}
        labels={sliderLabels} ariaLabel={ariaLabel} />
    </div>
  )
}
