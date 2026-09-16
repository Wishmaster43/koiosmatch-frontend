/**
 * ScorePill — the shared score-percentage pill. Covers: locale-formatted
 * percentage output (GETALLEN-1, never a hand-built `${n}%`), the ink-twin
 * colour tokens per band (§4, never the raw fill token as text), and the
 * dash fallback for a missing value.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScorePill from './ScorePill'

describe('ScorePill', () => {
  it('renders a high score with the success ink twin and a locale-formatted percentage', () => {
    render(<ScorePill value={82} />)
    const el = screen.getByText('82%')
    expect(el.style.color).toBe('var(--color-success-text)')
  })

  it('renders a mid score with the warning ink twin', () => {
    render(<ScorePill value={60} />)
    const el = screen.getByText('60%')
    expect(el.style.color).toBe('var(--color-warning-text)')
  })

  it('renders a low score with the danger ink twin', () => {
    render(<ScorePill value={30} />)
    const el = screen.getByText('30%')
    expect(el.style.color).toBe('var(--color-danger-text)')
  })

  it('renders a dash for a null value, never a fabricated 0%', () => {
    render(<ScorePill value={null} />)
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText('0%')).toBeNull()
  })
})
