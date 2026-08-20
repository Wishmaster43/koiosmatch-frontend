/**
 * CountBadge — pins the INVERSE trio pair (bg = --button-ink, text =
 * --button-fill). Herhaal-audit r4: one copy inverted onto --button-ink with a
 * DARK ink token (2.52:1) — a "repair" back to that token must go red here.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CountBadge from './CountBadge'

describe('CountBadge', () => {
  it('wears the inverted trio: ink-fill background with the button fill as text', () => {
    render(<CountBadge count={3} />)
    const badge = screen.getByText('3')
    expect(badge.style.background).toBe('var(--button-ink)')
    expect(badge.style.color).toBe('var(--button-fill)')
    expect(badge.style.color).not.toBe('var(--color-primary-text)')
  })
})
