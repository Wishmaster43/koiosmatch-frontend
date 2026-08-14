/**
 * reportComparePolarity — "up is good" is a property of the FIGURE being shown,
 * never of the sign of the delta. A rise in placements is good news; a rise in
 * rejections or in overdue tasks is not; a rise in average days-to-fill is bad
 * even though the raw number went up. Colouring every positive delta green would
 * tell a recruiter that MORE rejections is progress — a real finding this file
 * exists to prevent.
 *
 * Each report supplies its OWN map (metric key -> polarity) alongside its KPI
 * definitions; a key absent from the map renders NEUTRAL (no colour claim) rather
 * than guessing — the same "prefer showing less over showing something you
 * cannot back" rule as the null-percentage dash.
 */
export type ComparePolarity = 'up-good' | 'down-good' | 'neutral'

// Resolves a delta's meaning into a semantic tone the caller renders (never a
// raw sign check) — 'good' | 'bad' | 'neutral'. Zero delta is always neutral
// regardless of polarity: no change is not an improvement or a regression.
export function compareTone(delta: number, polarity: ComparePolarity): 'good' | 'bad' | 'neutral' {
  if (delta === 0 || polarity === 'neutral') return 'neutral'
  const rising = delta > 0
  const goodWhenRising = polarity === 'up-good'
  return rising === goodWhenRising ? 'good' : 'bad'
}
