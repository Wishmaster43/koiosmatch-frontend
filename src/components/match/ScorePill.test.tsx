import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScorePill from './ScorePill'

// D9 fix (§4/GETALLEN-1): ScorePill composes the shared Mono/SoftChip atoms and
// formatPercent instead of a hand-rolled font stack + literal '%' — this test
// pins the formatted, locale-aware output so that regression cannot creep back.
describe('ScorePill', () => {
  it('renders the score through formatPercent (nl-NL, no decimals for whole numbers)', () => {
    render(<ScorePill score={82} />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('rounds a fractional score before formatting', () => {
    render(<ScorePill score={74.6} />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders through the Mono atom (JetBrains Mono identity, not a local font stack)', () => {
    render(<ScorePill score={82} />)
    const mono = screen.getByText('82%')
    expect(mono.style.fontFamily).toContain('JetBrains Mono')
  })
})
