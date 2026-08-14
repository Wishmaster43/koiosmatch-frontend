/**
 * reportComparePolarity — proves the tone follows the FIGURE's own meaning, not
 * the raw sign of the delta. An increase in rejections must render 'bad' even
 * though the delta is positive; a decrease in average days-to-fill must render
 * 'good' even though the delta is negative.
 */
import { describe, it, expect } from 'vitest'
import { compareTone } from './reportComparePolarity'

describe('compareTone', () => {
  it('up-good: a rise is good, a fall is bad (e.g. placements)', () => {
    expect(compareTone(5, 'up-good')).toBe('good')
    expect(compareTone(-5, 'up-good')).toBe('bad')
  })

  it('down-good: a rise is bad, a fall is good (e.g. rejections, days-to-fill)', () => {
    expect(compareTone(5, 'down-good')).toBe('bad')
    expect(compareTone(-5, 'down-good')).toBe('good')
  })

  it('neutral polarity never claims good or bad regardless of sign', () => {
    expect(compareTone(5, 'neutral')).toBe('neutral')
    expect(compareTone(-5, 'neutral')).toBe('neutral')
  })

  it('a zero delta is always neutral, even under a real polarity', () => {
    expect(compareTone(0, 'up-good')).toBe('neutral')
    expect(compareTone(0, 'down-good')).toBe('neutral')
  })
})
