import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuickViewToggle from './QuickViewToggle'

// The one shared quick-view toggle (Blacklist/Archived/…) — guards the §4 soft-toggle behaviour
// so a page can never hand-roll a divergent one again (see the 5-style drift it replaced).
describe('QuickViewToggle', () => {
  it('renders the label and fires onToggle on click', () => {
    const onToggle = vi.fn()
    render(<QuickViewToggle active={false} onToggle={onToggle} label="Gearchiveerd" />)
    fireEvent.click(screen.getByRole('button', { name: 'Gearchiveerd' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('reflects the active state — aria-pressed + fontWeight 600 (inactive stays 500, never grey)', () => {
    const { rerender } = render(<QuickViewToggle active={false} onToggle={() => {}} label="Blacklist" />)
    let btn = screen.getByRole('button', { name: 'Blacklist' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn.style.fontWeight).toBe('500')

    rerender(<QuickViewToggle active onToggle={() => {}} label="Blacklist" />)
    btn = screen.getByRole('button', { name: 'Blacklist' })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn.style.fontWeight).toBe('600')
  })

  // Text colour must be darkened toward readable --text; background/border keep the raw colour.
  it('darkens text colour for readability while background/border keep the raw colour', () => {
    render(<QuickViewToggle active onToggle={() => {}} label="Sick" color="#ffdd00" />)
    const btn = screen.getByRole('button', { name: 'Sick' })
    expect(btn.style.color).toBe('color-mix(in srgb, #ffdd00 60%, var(--text))')
    expect(btn.style.background).toBe('color-mix(in srgb, rgb(255, 221, 0) 16%, transparent)')
    expect(btn.style.border).toContain('color-mix(in srgb, rgb(255, 221, 0)')
  })

  it('uses the readable primary-text token for the default primary colour', () => {
    render(<QuickViewToggle active onToggle={() => {}} label="Default" />)
    const btn = screen.getByRole('button', { name: 'Default' })
    expect(btn.style.color).toBe('var(--color-primary-text)')
  })
})
